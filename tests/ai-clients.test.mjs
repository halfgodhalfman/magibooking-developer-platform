import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,chmod,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startOAuth} from '../examples/ai-clients/oauth.mjs';
import {readCredential,STAGING_ORIGIN,PRODUCTION_ORIGIN,connectionProfile,resourceFor} from '../packages/mcp/credentials.mjs';
import {openAIRequest} from '../examples/ai-clients/openai.mjs';
import {executeReadTool,runDeepSeek} from '../examples/ai-clients/deepseek.mjs';
const token='mb_oauth_'+'a'.repeat(64);
const credential=()=>({origin:STAGING_ORIGIN,resource:resourceFor('mcp'),clientId:'client_test',accessToken:token,expiresAt:Date.now()+3600000,scopes:['catalog:read']});

test('OAuth helper rejects callback tampering and exchanges exact resource/redirect with S256',async t=>{
  let calls=0,authorization;
  const flow=await startOAuth({clientId:'client_test',fetchImpl:async(url,init)=>{
    calls++;assert.equal(url,STAGING_ORIGIN+'/api/developer/oauth/token/');assert.equal(init.redirect,'error');
    const p=init.body;assert.equal(p.get('redirect_uri'),flow.redirectUri);assert.equal(p.get('resource'),resourceFor('mcp'));
    assert.equal(createHash('sha256').update(p.get('code_verifier')).digest('base64url'),authorization.searchParams.get('code_challenge'));
    return Response.json({access_token:token,token_type:'Bearer',expires_in:3600,scope:'catalog:read'});
  }});t.after(flow.close);authorization=new URL(flow.authorizationUrl);
  assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');assert(!authorization.searchParams.has('code_verifier'));
  assert.equal(authorization.searchParams.get('scope'),'catalog:read availability:read appointments:read');
  const callback=new URL(flow.redirectUri);callback.searchParams.set('state',authorization.searchParams.get('state'));callback.searchParams.set('iss',STAGING_ORIGIN);callback.searchParams.set('code','b'.repeat(64));
  for(const mutate of [u=>u.searchParams.set('state','wrong-state'),u=>u.searchParams.set('iss','https://attacker.invalid'),u=>u.searchParams.append('code','c'.repeat(64))]){
    const u=new URL(callback);mutate(u);assert.equal((await fetch(u)).status,400);
  }
  assert.equal(calls,0);assert.equal((await fetch(callback)).status,200);const c=await flow.done;assert.equal(c.accessToken,token);assert.equal(calls,1);
});
test('OAuth denial rejects cleanly without a token request',async t=>{
  const flow=await startOAuth({clientId:'client_test',audience:'api',fetchImpl:()=>{throw Error('Must not exchange');}});t.after(flow.close);
  const a=new URL(flow.authorizationUrl),u=new URL(flow.redirectUri);assert.equal(a.searchParams.get('resource'),resourceFor('api'));
  for(const[k,v]of Object.entries({state:a.searchParams.get('state'),iss:STAGING_ORIGIN,error:'access_denied'}))u.searchParams.set(k,v);
  const rejection=assert.rejects(flow.done,/declined/);assert.equal((await fetch(u)).status,400);await rejection;
});
test('credential loader rejects audience confusion, stale tokens, broad scopes, permissions and symlinks',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'magi-credential-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'token.private.json');
  await writeFile(file,JSON.stringify(credential()),{mode:0o600});assert.equal((await readCredential(file,'mcp')).clientId,'client_test');await assert.rejects(readCredential(file,'api'));
  for(const override of [{expiresAt:Date.now()-1},{origin:'https://attacker.invalid'},{scopes:['appointments:create']},{accessToken:'wrong'}]){await writeFile(file,JSON.stringify({...credential(),...override}));await assert.rejects(readCredential(file,'mcp'));}
  await writeFile(file,JSON.stringify(credential()));await chmod(file,0o644);await assert.rejects(readCredential(file,'mcp'));await chmod(file,0o600);
  const link=join(dir,'link.private.json');await symlink(file,link);await assert.rejects(readCredential(link,'mcp'));
});
test('explicit production profile rejects staging credentials and ambiguous production files',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'magi-profile-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'token.private.json');
  assert.equal(connectionProfile().origin,STAGING_ORIGIN);assert.throws(()=>connectionProfile('https://attacker.invalid'));
  await writeFile(file,JSON.stringify(credential()),{mode:0o600});await assert.rejects(readCredential(file,'mcp','production'));
  const production={...credential(),environment:'production',origin:PRODUCTION_ORIGIN,resource:resourceFor('mcp','production')};
  await writeFile(file,JSON.stringify(production));assert.equal((await readCredential(file,'mcp','production')).origin,PRODUCTION_ORIGIN);await assert.rejects(readCredential(file,'mcp','staging'));await assert.rejects(readCredential(file,'api','production'));
  delete production.environment;await writeFile(file,JSON.stringify(production));await assert.rejects(readCredential(file,'mcp','production'));
});
test('production OAuth uses exact production issuer and resource without a real provider call',async t=>{
  let calls=0;
  const flow=await startOAuth({clientId:'client_test',environment:'production',fetchImpl:async(url,init)=>{calls++;assert.equal(url,PRODUCTION_ORIGIN+'/api/developer/oauth/token/');assert.equal(init.body.get('resource'),resourceFor('mcp','production'));return Response.json({access_token:token,token_type:'Bearer',expires_in:3600,scope:'catalog:read'});}});t.after(flow.close);
  const a=new URL(flow.authorizationUrl);assert.equal(a.origin,PRODUCTION_ORIGIN);const u=new URL(flow.redirectUri);u.searchParams.set('state',a.searchParams.get('state'));u.searchParams.set('iss',STAGING_ORIGIN);u.searchParams.set('code','b'.repeat(64));assert.equal((await fetch(u)).status,400);assert.equal(calls,0);
  u.searchParams.set('iss',PRODUCTION_ORIGIN);assert.equal((await fetch(u)).status,200);const c=await flow.done;assert.equal(c.environment,'production');assert.equal(calls,1);
  assert.throws(()=>openAIRequest({model:'test',credential:c}));assert.equal(openAIRequest({model:'test',credential:c,environment:'production'}).tools[0].server_url,resourceFor('mcp','production'));
});
test('OpenAI request restricts remote MCP to two reads and keeps token out of prompt',()=>{
  const r=openAIRequest({model:'model_under_test',credential:credential()});assert.equal(r.store,false);assert.equal(r.tools[0].server_url,resourceFor('mcp'));assert.deepEqual(r.tools[0].allowed_tools,['list_services','list_staff']);assert.equal(r.tools[0].authorization,token);assert(!r.input.includes(token));assert.throws(()=>openAIRequest({model:'test',credential:{...credential(),resource:resourceFor('api')}}));
});
test('DeepSeek executor rejects model-supplied writes, URLs, merchant selection and malformed arguments',async()=>{
  let calls=0;const api={services:async()=>{calls++;return{data:[]};},staff:async()=>{calls++;return{data:[]};}};
  const call={id:'call1',type:'function',function:{name:'list_services',arguments:'{}'}};
  await executeReadTool(api,call);assert.equal(calls,1);
  for(const change of [{name:'cancel_appointment',arguments:'{}'},{name:'list_services',arguments:'{"url":"https://attacker.invalid"}'},{name:'list_staff',arguments:'{"merchant_id":"other"}'},{name:'list_services',arguments:'null'},{name:'list_services',arguments:'[]'},{name:'list_services',arguments:'invalid'}])await assert.rejects(executeReadTool(api,{...call,function:change}));
  assert.equal(calls,1);
});
test('DeepSeek loop executes read, returns result, excludes MagiBooking credentials and bounds repeated calls',async()=>{
  let turns=0;const seen=[],api={services:async()=>({data:[{name:'Synthetic service'}]})};
  const fetchImpl=async(url,init)=>{assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(init.redirect,'error');seen.push(init.body);turns++;return Response.json({choices:[{message:turns===1?{role:'assistant',tool_calls:[{id:'c1',type:'function',function:{name:'list_services',arguments:'{}'}}]}:{role:'assistant',content:'Synthetic result'}}]});};
  const result=await runDeepSeek({api,model:'test_model',apiKey:'provider_placeholder',fetchImpl});assert.equal(result.tool_calls,1);assert(seen[1].includes('Synthetic service'));assert(seen.every(s=>!s.includes(token)));
  let reads=0;await assert.rejects(runDeepSeek({api:{services:async()=>{reads++;return{data:[]};}},model:'test',apiKey:'placeholder',fetchImpl:async()=>Response.json({choices:[{message:{tool_calls:[{id:'c',type:'function',function:{name:'list_services',arguments:'{}'}}]}}]})}),/budget/);assert.equal(reads,4);
});
