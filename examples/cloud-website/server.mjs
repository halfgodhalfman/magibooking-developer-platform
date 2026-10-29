// Staging-only API-backed demo. Keep credentials on this loopback server.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {MagiBooking,MagiBookingError} from '../../packages/javascript/index.mjs';
const port=Number(process.env.PORT||4331),origin=`http://127.0.0.1:${port}`;
if(process.env.MAGI_API_ORIGIN!=='https://staging.magibooking.com')throw Error('This demo accepts the staging origin only');
const api=new MagiBooking({baseUrl:process.env.MAGI_API_ORIGIN,token:process.env.MAGI_API_TOKEN,merchantId:process.env.MAGI_MERCHANT_ID});
const directory=new URL('./',import.meta.url);
export const server=createServer(async(req,res)=>{
 const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(type==='application/json'?JSON.stringify(data):data);};
 try{
  const url=new URL(req.url,origin);
  const assets={'/':'index.html','/app.mjs':'app.mjs','/style.css':'style.css'};
  if(req.method==='GET'&&assets[url.pathname])return send(200,await readFile(new URL(assets[url.pathname],directory)),url.pathname.endsWith('.mjs')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');
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
  if(url.pathname==='/api/appointments'){
   if(body.new_client?.phone!=='+15005550006'||body.new_client?.email!=='staging-demo@example.test'||!String(body.new_client?.name||'').startsWith('STAGING QA'))return send(400,{error:{code:'SYNTHETIC_CUSTOMER_REQUIRED'}});
   return send(201,await api.createAppointment(body,key));
  }
  const match=/^\/api\/appointments\/([A-Za-z0-9_-]+)\/(reschedule|cancel)$/.exec(url.pathname);
  if(match)return send(200,await api[match[2]==='reschedule'?'rescheduleAppointment':'cancelAppointment'](match[1],body,{idempotencyKey:key,ifMatch}));
  return send(404,{error:{code:'NOT_FOUND'}});
 }catch(e){if(e instanceof MagiBookingError)return send(e.status||502,{error:{code:e.code,request_id:e.requestId}});return send(502,{error:{code:'TRANSPORT_ERROR',message:'Outcome unknown. Keep the same operation key and body for any deliberate retry.'}});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Staging booking demo: ${origin}`));
