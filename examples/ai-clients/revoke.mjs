import {unlink} from 'node:fs/promises';
import {readCredential} from '../../packages/mcp/credentials.mjs';
const audience=process.argv[2]||'mcp';
try{
  const file=process.env.MAGI_AI_TOKEN_FILE,c=await readCredential(file,audience);
  const r=await fetch(c.origin+'/api/developer/oauth/revoke/',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),body:new URLSearchParams({token:c.accessToken,client_id:c.clientId})});
  if(!r.ok)throw Error('Token revocation not confirmed; local credential retained');
  await unlink(file);
  console.log('This token is revoked. For all tokens and Webhooks, revoke the application grant in Developer access.');
}catch{console.error('Could not complete token cleanup. Check the file/audience, or revoke the full grant in Developer access.');process.exitCode=1;}
