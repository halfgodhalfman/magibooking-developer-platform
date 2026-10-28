// Optional stdio bridge for clients without native Streamable HTTP support.
// Token must be issued specifically for the hosted MCP resource; no REST token forwarding.
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
let origin;try{origin=new URL(process.env.MAGI_MCP_ORIGIN||'http://invalid');}catch{throw Error('MAGI_MCP_ORIGIN must be an HTTPS origin');}
if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('MAGI_MCP_ORIGIN must be an HTTPS origin');
const token=process.env.MAGI_MCP_ACCESS_TOKEN||'';if(!/^mb_oauth_[a-f0-9]{64}$/.test(token))throw Error('MCP-audience OAuth access token required');
const remote=new Client({name:'magibooking-stdio-bridge',version:'0.3.0-preview.1'});
await remote.connect(new StreamableHTTPClientTransport(new URL('/api/developer/mcp/',origin),{requestInit:{headers:{Authorization:`Bearer ${token}`}},fetch:(url,init)=>fetch(url,{...init,redirect:'error'})}));
const server=new Server({name:'magibooking',version:'0.3.0-preview.1'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,()=>remote.listTools());
server.setRequestHandler(CallToolRequestSchema,request=>remote.callTool(request.params));
await server.connect(new StdioServerTransport());
process.once('SIGINT',async()=>{await remote.close();await server.close();process.exit(0);});
