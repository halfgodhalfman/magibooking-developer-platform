import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('MCP source bridge rejects unsafe origins and missing MCP tokens before any connection',()=>{
 for(const origin of ['not-a-url','http://example.invalid','https://user:password@example.invalid','https://example.invalid/path','https://example.invalid/?token=bad']){const r=spawnSync(process.execPath,['packages/mcp/stdio.mjs'],{env:{...process.env,MAGI_MCP_ORIGIN:origin,MAGI_MCP_ACCESS_TOKEN:'test-invalid'},encoding:'utf8'});assert.notEqual(r.status,0);assert(r.stderr.includes('must be an HTTPS origin'));assert.equal(r.stdout,'');}
 const r=spawnSync(process.execPath,['packages/mcp/stdio.mjs'],{env:{...process.env,MAGI_MCP_ORIGIN:'https://example.invalid',MAGI_MCP_ACCESS_TOKEN:'test-invalid'},encoding:'utf8'});assert.notEqual(r.status,0);assert(r.stderr.includes('MCP-audience OAuth access token required'));assert.equal(r.stdout,'');
});
