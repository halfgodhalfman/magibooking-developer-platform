import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {once} from 'node:events';
import {writeFile,access} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {connectionProfile,READ_SCOPES,resourceFor} from '../../packages/mcp/credentials.mjs';

// The operator preregisters http://127.0.0.1/callback. Only its port may vary.
// The user completes login and consent in their browser; this helper never does.
export async function startOAuth({clientId,audience='mcp',environment='staging',port=0,fetchImpl=fetch,timeoutMs=300000}){
  const{origin}=connectionProfile(environment);
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(clientId||''))throw Error('Set the preregistered MAGI_AI_CLIENT_ID');
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid callback port');
  const resource=resourceFor(audience,environment),state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  let resolve,reject,settled=false,consuming=false;
  const done=new Promise((a,b)=>{resolve=a;reject=b;});
  // A rejection handler is installed immediately, including while the caller opens a browser.
  done.catch(()=>{});
  const server=createServer(async(req,res)=>{
    const finish=(status,message)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});res.end(message);};
    try{
      const host=`127.0.0.1:${server.address().port}`;
      if(req.headers.host!==host||req.method!=='GET')return finish(403,'Invalid callback request.');
      const url=new URL(req.url,`http://${host}`);
      if(url.pathname!=='/callback')return finish(404,'Not found.');
      if([...url.searchParams.keys()].some(k=>!['state','iss','code','error','error_description'].includes(k)||url.searchParams.getAll(k).length!==1)||url.searchParams.get('state')!==state||url.searchParams.get('iss')!==origin)return finish(400,'Invalid state or issuer. Return to your original authorization tab.');
      if(consuming||settled)return finish(409,'Callback already consumed.');
      if(url.searchParams.has('error')){settled=true;finish(400,'Authorization declined.');reject(Error('Authorization declined'));return;}
      const code=url.searchParams.get('code');if(!/^[a-f0-9]{64}$/.test(code||''))return finish(400,'Invalid authorization code.');
      consuming=true;
      const response=await fetchImpl(origin+'/api/developer/oauth/token/',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,redirect_uri:`http://${host}/callback`,resource,code,code_verifier:verifier})});
      if(!response.ok)throw Error('OAuth exchange failed; reconnect instead of replaying the code');
      const result=await response.json();
      if(!/^mb_oauth_[a-f0-9]{64}$/.test(result.access_token||'')||result.token_type!=='Bearer'||!Number.isInteger(result.expires_in)||result.expires_in<=0||result.expires_in>3600||typeof result.scope!=='string'||!result.scope.split(' ').every(s=>READ_SCOPES.includes(s)))throw Error('Invalid or broader-than-requested token response');
      settled=true;finish(200,`Connected to MagiBooking ${environment}. You can close this tab and return to your terminal.`);
      resolve({environment,origin,resource,clientId,accessToken:result.access_token,expiresAt:Date.now()+result.expires_in*1000,scopes:result.scope.split(' ')});
    }catch{settled=true;finish(502,'Connection failed. Return to your terminal and start a new connection.');reject(Error('OAuth connection failed'));}
  });
  server.listen(port,'127.0.0.1');await once(server,'listening');
  const redirectUri=`http://127.0.0.1:${server.address().port}/callback`;
  const query=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirectUri,resource,state,scope:READ_SCOPES.join(' '),code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  const timer=setTimeout(()=>{settled=true;reject(Error('Authorization timed out'));server.close();},timeoutMs);timer.unref();
  const close=()=>{clearTimeout(timer);server.close();};
  done.then(close,close);
  return{authorizationUrl:origin+'/api/developer/oauth/authorize/?'+query,redirectUri,done,close};
}

async function main(){
  const audience=process.argv[2]||'mcp',file=process.env.MAGI_AI_TOKEN_FILE;
  if(!file||!file.endsWith('.private.json'))throw Error('Set MAGI_AI_TOKEN_FILE ending in .private.json; use a private directory outside your repository');
  try{await access(file);throw Error('Credential file exists; choose another path or revoke the old token first');}catch(e){if(e.code!=='ENOENT')throw e;}
  const environment=process.env.MAGI_AI_ENVIRONMENT||'staging';
  const flow=await startOAuth({clientId:process.env.MAGI_AI_CLIENT_ID,audience,environment});
  console.log(`Environment: ${environment}. Open this URL yourself, select the intended store, and approve only the read permissions:`);console.log(flow.authorizationUrl);
  const stop=()=>{flow.close();process.exit(130);};process.once('SIGINT',stop);
  try{
    const credential=await flow.done;
    try{await writeFile(file,JSON.stringify(credential,null,2),{flag:'wx',mode:0o600});}
    catch{
      const r=await fetch(credential.origin+'/api/developer/oauth/revoke/',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),body:new URLSearchParams({token:credential.accessToken,client_id:credential.clientId})});
      throw Error(r.ok?'Could not save credential; newly issued token revoked':'Could not save credential; revoke this grant in Developer access');
    }
    console.log('Connected. Credential saved privately; expires within one hour. No refresh token issued.');
  }finally{flow.close();process.removeListener('SIGINT',stop);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.code?'Local connection failed':e.message);process.exitCode=1;});
