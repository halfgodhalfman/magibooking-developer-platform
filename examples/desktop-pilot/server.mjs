// Staging-only API-backed demo. Keep credentials on this loopback server.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,createHash}from'node:crypto';
import {MagiBooking,MagiBookingError} from '../../packages/javascript/index.mjs';
const cfg=JSON.parse(await readFile(process.env.MAGI_PILOT_CONFIG||new URL('./pilot-config.private.json',import.meta.url),'utf8'));
const port=Number(process.env.MAGI_PILOT_PORT||4332),cloud='https://staging.magibooking.com',resource=cloud+'/api/developer/v1/';
if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid loopback port');
if(!/^[A-Za-z0-9_-]+$/.test(cfg.clientId)||!/^[A-Za-z0-9_-]+$/.test(cfg.merchantId))throw Error('Pilot configuration required');
const receiverOrigin=new URL(cfg.receiverUrl);if(receiverOrigin.protocol!=='https:'||receiverOrigin.username||receiverOrigin.password||receiverOrigin.search||receiverOrigin.hash||!receiverOrigin.pathname.endsWith('/')||!/^[A-Za-z0-9_-]{32,128}$/.test(cfg.receiverReadToken||''))throw Error('Protected HTTPS receiver configuration required');
const sessions=new Map(),random=()=>randomBytes(32).toString('base64url');
const scopes='catalog:read availability:read appointments:read appointments:create appointments:reschedule appointments:cancel';
async function revoke(token){const r=await fetch(cloud+'/api/developer/oauth/revoke/',{method:'POST',body:new URLSearchParams({token,client_id:cfg.clientId}),redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Revocation not confirmed');}
const directory=new URL('./',import.meta.url);
export const server=createServer(async(req,res)=>{
 const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(type==='application/json'?JSON.stringify(data):data);};
 try{
  const actualPort=server.address().port,origin=`http://127.0.0.1:${actualPort}`,redirectUri=origin+'/callback';
  if(req.headers.host!==`127.0.0.1:${actualPort}`)return send(403,{error:{code:'INVALID_HOST'}});
  const url=new URL(req.url,origin);
  for(const[id,item]of sessions)if(item.expires<Date.now())sessions.delete(id);
  let sid=(req.headers.cookie||'').match(/(?:^|;\s*)magi_pilot=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1],session=sessions.get(sid);
  if(!session&&req.method==='GET'&&url.pathname==='/'){
   if(sessions.size>=16)return send(429,{error:{code:'SESSION_LIMIT'}});
   sid=random();session={expires:Date.now()+3600000};sessions.set(sid,session);res.setHeader('Set-Cookie',`magi_pilot=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`);
  }
  if(req.method==='GET'&&url.pathname==='/api/connection')return send(200,{connected:!!session?.token,callback:redirectUri});
  if(req.method==='POST'&&url.pathname==='/oauth/start'){
   if(req.headers.origin!==origin||!session)return send(403,{error:{code:'INVALID_ORIGIN'}});
   const state=random(),verifier=random();session.pending={state,verifier,expires:Date.now()+600000};
   const query=new URLSearchParams({response_type:'code',client_id:cfg.clientId,redirect_uri:redirectUri,resource,state,scope:scopes,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
   return send(200,{authorizationUrl:cloud+'/api/developer/oauth/authorize/?'+query});
  }
  if(req.method==='GET'&&url.pathname==='/callback'){
   const pending=session?.pending;
   if(!pending||pending.expires<Date.now()||url.searchParams.get('state')!==pending.state||url.searchParams.get('iss')!==cloud)return send(400,{error:{code:'OAUTH_STATE_OR_ISSUER_INVALID'}});
   delete session.pending;
   if(url.searchParams.has('error'))return send(400,{error:{code:'AUTHORIZATION_DECLINED'}});
   const code=url.searchParams.get('code');if(!/^[a-f0-9]{64}$/.test(code||''))return send(400,{error:{code:'INVALID_CODE'}});
   const response=await fetch(cloud+'/api/developer/oauth/token/',{method:'POST',body:new URLSearchParams({grant_type:'authorization_code',client_id:cfg.clientId,redirect_uri:redirectUri,resource,code,code_verifier:pending.verifier}),redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)return send(400,{error:{code:'OAUTH_EXCHANGE_FAILED_RECONNECT'}});
   const result=await response.json();if(!/^mb_oauth_[a-f0-9]{64}$/.test(result.access_token||''))return send(502,{error:{code:'INVALID_TOKEN_RESPONSE'}});
   const check=new MagiBooking({baseUrl:cloud,token:result.access_token,merchantId:cfg.merchantId});
   try{await check.services();}catch{await revoke(result.access_token);return send(403,{error:{code:'SELECT_YOUR_DEVELOPER_SANDBOX_WITH_CATALOG_SCOPE'}});}
   if(session.token)await revoke(session.token);session.token=result.access_token;session.expires=Date.now()+Math.min(3600,result.expires_in)*1000;
   res.writeHead(303,{'Location':'/','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
  }
  if(req.method==='POST'&&url.pathname==='/oauth/disconnect'){
   if(req.headers.origin!==origin||!session)return send(403,{error:{code:'INVALID_ORIGIN'}});
   if(session.token)await revoke(session.token);delete session.token;return send(200,{revoked:true});
  }
  if(req.method==='GET'&&url.pathname==='/api/events'){
   if(!session?.token)return send(401,{error:{code:'CONNECT_TEST_STORE_FIRST'}});
   await new MagiBooking({baseUrl:cloud,token:session.token,merchantId:cfg.merchantId}).services();
   const response=await fetch(cfg.receiverUrl+'events',{headers:{Authorization:'Bearer '+cfg.receiverReadToken},redirect:'error',signal:AbortSignal.timeout(15000)});
   return send(response.status,await response.json());
  }
  const api=session?.token?new MagiBooking({baseUrl:cloud,token:session.token,merchantId:cfg.merchantId}):null;
  const assets={'/':'index.html','/app.mjs':'app.mjs','/style.css':'style.css'};
  if(req.method==='GET'&&assets[url.pathname])return send(200,await readFile(new URL(assets[url.pathname],directory)),url.pathname.endsWith('.mjs')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');
  if(url.pathname.startsWith('/api/')&&!api)return send(401,{error:{code:'CONNECT_TEST_STORE_FIRST'}});
  if(req.method==='GET'&&url.pathname==='/api/services')return send(200,await api.services());
  if(req.method==='GET'&&url.pathname==='/api/staff')return send(200,await api.staff());
  if(req.method==='GET'&&url.pathname==='/api/availability')return send(200,await api.availability(Object.fromEntries(url.searchParams)));
  const readMatch=/^\/api\/appointments\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
  if(req.method==='GET'&&readMatch)return send(200,await api.appointment(readMatch[1]));
  if(req.method!=='POST')return send(404,{error:{code:'NOT_FOUND'}});
  if(req.headers.origin!==`http://127.0.0.1:${server.address().port}`)return send(403,{error:{code:'INVALID_ORIGIN'}});
  let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>16384)return send(413,{error:{code:'BODY_TOO_LARGE'}});}
  let body;try{body=JSON.parse(raw);}catch{return send(400,{error:{code:'INVALID_JSON'}});}
  const key=req.headers['idempotency-key'],ifMatch=req.headers['if-match'];
  if(!api)return send(401,{error:{code:'CONNECT_TEST_STORE_FIRST'}});
  if(url.pathname==='/api/appointments'){
   if(body.new_client?.phone!=='+15005550006'||body.new_client?.email!=='staging-demo@example.test'||!String(body.new_client?.name||'').startsWith('STAGING QA'))return send(400,{error:{code:'SYNTHETIC_CUSTOMER_REQUIRED'}});
   return send(201,await api.createAppointment(body,key));
  }
  const match=/^\/api\/appointments\/([A-Za-z0-9_-]+)\/(reschedule|cancel)$/.exec(url.pathname);
  if(match)return send(200,await api[match[2]==='reschedule'?'rescheduleAppointment':'cancelAppointment'](match[1],body,{idempotencyKey:key,ifMatch}));
  return send(404,{error:{code:'NOT_FOUND'}});
 }catch(e){if(e instanceof MagiBookingError)return send(e.status||502,{error:{code:e.code,request_id:e.requestId}});return send(502,{error:{code:'TRANSPORT_ERROR',message:'Outcome unknown. Keep the same operation key and body for any deliberate retry.'}});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Desktop OAuth pilot: http://127.0.0.1:${server.address().port}`));
