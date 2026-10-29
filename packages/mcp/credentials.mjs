// Source-only helper. Never print credentials or include these files in a browser bundle.
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
export const STAGING_ORIGIN='https://staging.magibooking.com';
export const PRODUCTION_ORIGIN='https://www.magibooking.com';
export function connectionProfile(environment='staging'){
  if(!['staging','production'].includes(environment))throw Error('Select staging or production explicitly');
  return{environment,origin:environment==='production'?PRODUCTION_ORIGIN:STAGING_ORIGIN};
}
export const READ_SCOPES=['catalog:read','availability:read','appointments:read'];
export const resourceFor=(audience,environment='staging')=>{
  if(!['mcp','api'].includes(audience))throw Error('Audience must be mcp or api');
  return `${connectionProfile(environment).origin}/api/developer/${audience==='mcp'?'mcp':'v1'}/`;
};
export async function readCredential(path,audience,environment=process.env.MAGI_AI_ENVIRONMENT||'staging'){
  const profile=connectionProfile(environment);
  if(!path)throw Error('Set MAGI_AI_TOKEN_FILE to your private OAuth credential file');
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
    const stat=await file.stat();
    if(!stat.isFile()||stat.size>16384||(stat.mode&0o077)!==0||(process.getuid&&stat.uid!==process.getuid()))throw Error('Credential must be an owned regular file with mode 600');
    const value=JSON.parse(await file.readFile('utf8'));
    // Older staging helper files remain readable. Production files must identify
    // the environment explicitly; never infer production from a token or URL.
    const fileEnvironment=value.environment??(value.origin===STAGING_ORIGIN?'staging':null);
    if(fileEnvironment!==environment||value.origin!==profile.origin||value.resource!==resourceFor(audience,environment)||!/^mb_oauth_[a-f0-9]{64}$/.test(value.accessToken||'')||!/^[A-Za-z0-9_-]{1,128}$/.test(value.clientId||'')||!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now()+10000||!Array.isArray(value.scopes)||!value.scopes.length||value.scopes.some(s=>!READ_SCOPES.includes(s)))throw Error('Wrong environment, audience, scopes or expired credential');
    return{...value,environment};
  }catch{throw Error('Invalid private OAuth credential; check its audience, scopes and expiry without printing its contents');}finally{await file.close();}
}
