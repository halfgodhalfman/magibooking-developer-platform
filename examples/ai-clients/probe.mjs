// Protocol-only test, not a real-model compatibility claim.
import {Client} from '../../packages/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StreamableHTTPClientTransport} from '../../packages/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
import {readCredential,resourceFor} from '../../packages/mcp/credentials.mjs';
const credential=await readCredential(process.env.MAGI_AI_TOKEN_FILE,'mcp');
const client=new Client({name:'magibooking-source-probe',version:'0.3.0-preview.1'});
try{
  await client.connect(new StreamableHTTPClientTransport(new URL(resourceFor('mcp',credential.environment)),{requestInit:{headers:{Authorization:`Bearer ${credential.accessToken}`}},fetch:(url,init)=>fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(30000)})}));
  const {tools}=await client.listTools();
  const mutations=tools.filter(t=>!t.annotations?.readOnlyHint);
  if(mutations.length)throw Error('Reconnect using the read-only OAuth helper; mutation tools are outside this probe');
  const read=await client.callTool({name:'list_services',arguments:{}});
  if(read.isError)throw Error('Catalog query rejected');
  console.log(JSON.stringify({protocol:'Streamable HTTP',tools:tools.map(t=>t.name),catalogRead:'passed',realModelTest:false}));
}finally{await client.close();}
