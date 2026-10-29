import {pathToFileURL} from 'node:url';
import {MagiBooking} from '../../packages/javascript/index.mjs';
import {readCredential} from '../../packages/mcp/credentials.mjs';
export const deepSeekTools=['list_services','list_staff'].map(name=>({type:'function',function:{name,description:name==='list_services'?'List services and prices in the authorized sandbox store':'List bookable staff in the authorized sandbox store',parameters:{type:'object',properties:{},required:[],additionalProperties:false}}}));
export async function executeReadTool(api,call){
  if(call?.type!=='function'||!['list_services','list_staff'].includes(call.function?.name)||typeof call.id!=='string')throw Error('Unapproved tool call');
  let args;try{args=JSON.parse(call.function.arguments);}catch{throw Error('Invalid tool arguments');}
  if(!args||Array.isArray(args)||typeof args!=='object'||Object.keys(args).length)throw Error('Unexpected tool arguments');
  return call.function.name==='list_services'?api.services():api.staff();
}
export async function runDeepSeek({api,model,apiKey,fetchImpl=fetch}){
  if(!model||!apiKey)throw Error('Set DEEPSEEK_MODEL and DEEPSEEK_API_KEY locally');
  const messages=[{role:'system',content:'Only list services or staff from this authorized sandbox store. Do not invent results or request changes.'},{role:'user',content:'Show the available services and bookable staff.'}];
  let count=0;
  for(let round=0;round<4;round++){
    const response=await fetchImpl('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages,tools:deepSeekTools,thinking:{type:'disabled'}})});
    if(!response.ok)throw Error(`DeepSeek request failed (HTTP ${response.status}); no automatic retry`);
    const result=await response.json(),message=result.choices?.[0]?.message;
    if(!message)throw Error('Invalid DeepSeek response');
    if(!message.tool_calls?.length)return{status:'complete',tool_calls:count,message:'Model finished. Customer data is not printed by this example.'};
    if(message.tool_calls.length>2||count+message.tool_calls.length>4)throw Error('Tool budget exceeded');
    messages.push({role:'assistant',content:message.content||null,tool_calls:message.tool_calls});
    for(const call of message.tool_calls){const data=await executeReadTool(api,call);count++;messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(data)});}
  }
  throw Error('Model turn budget exceeded');
}
async function main(){
  if(!process.argv.includes('--allow-provider-data'))throw Error('Read the guide, then pass --allow-provider-data to send sandbox catalog results to DeepSeek. MagiBooking tokens remain local.');
  const c=await readCredential(process.env.MAGI_AI_TOKEN_FILE,'api');
  const api=new MagiBooking({baseUrl:c.origin,merchantId:process.env.MAGI_AI_MERCHANT_ID,token:c.accessToken});
  console.log(JSON.stringify(await runDeepSeek({api,model:process.env.DEEPSEEK_MODEL,apiKey:process.env.DEEPSEEK_API_KEY}),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e instanceof Error&&e.name==='MagiBookingError'?`MagiBooking ${e.code} (${e.status}); reconnect on 401`:e.message);process.exitCode=1;});
