import {pathToFileURL} from 'node:url';
import {readCredential,resourceFor} from '../../packages/mcp/credentials.mjs';
export function openAIRequest({model,credential,environment='staging'}){
  if(!model)throw Error('Set OPENAI_MODEL to a model available to your account with remote MCP support');
  if(credential.resource!==resourceFor('mcp',environment))throw Error('Matching environment and MCP-audience credential required');
  return{model,store:false,input:'List the services and bookable staff for my authorized store. Do not make changes.',tools:[{type:'mcp',server_label:`magibooking_${environment}`,server_url:resourceFor('mcp',environment),authorization:credential.accessToken,allowed_tools:['list_services','list_staff'],require_approval:'never'}]};
}
async function main(){
  if(!process.argv.includes('--allow-provider-data'))throw Error('Read the guide, then pass --allow-provider-data to send your short-lived MCP token and test tool results to OpenAI');
  if(!process.env.OPENAI_API_KEY)throw Error('Configure OPENAI_API_KEY locally; never paste it into chat');
  const credential=await readCredential(process.env.MAGI_AI_TOKEN_FILE,'mcp');
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(openAIRequest({model:process.env.OPENAI_MODEL,credential,environment:credential.environment}))});
  if(!response.ok)throw Error(`OpenAI request failed (HTTP ${response.status}); no automatic retry`);
  const result=await response.json();
  // Never dump a whole provider response: it may contain tool results or credentials.
  if((result.output||[]).some(x=>x.type==='mcp_approval_request'))throw Error('Unexpected approval request; inspect it in your own application');
  console.log(JSON.stringify({status:result.status,response_id:result.id,tool_calls:(result.output||[]).filter(x=>x.type==='mcp_call').map(x=>({name:x.name,status:x.status,error:!!x.error})),message:'Inspect the response in your own application. The example does not print customer records.'},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
