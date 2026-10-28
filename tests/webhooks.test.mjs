import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createHmac, randomUUID } from 'node:crypto';
import { verifyMagiBookingWebhook } from '../packages/javascript/webhooks.mjs';
import { createWebhookReceiver } from '../examples/webhook-receiver/server.mjs';
test('signature helper rejects body tampering, wrong key and stale timestamp', () => {
  const rawBody = Buffer.from('{"id":1}'); const timestamp = String(Math.floor(Date.now()/1000)); const signature = 'v1=' + createHmac('sha256','test').update(timestamp + '.').update(rawBody).digest('hex');
  assert(verifyMagiBookingWebhook({secret:'test', timestamp, signature,rawBody}));
  assert(!verifyMagiBookingWebhook({secret:'test',timestamp,signature,rawBody:Buffer.from('{ "id":1}')}));
  assert(!verifyMagiBookingWebhook({secret:'other',timestamp,signature,rawBody}));
  assert(!verifyMagiBookingWebhook({secret:'test',timestamp,signature,rawBody,now:Date.now()+301000}));
});
test('receiver durably journals concurrent duplicates and recognizes events after restart', async t => {
  const directory=await mkdtemp(join(tmpdir(),'magibooking-webhooks-')); t.after(()=>rm(directory,{recursive:true,force:true}));
  const secret='mb_whsec_'+'a'.repeat(64); const event={id:randomUUID(),type:'appointment.created',data:{appointment:{id:'test'}}}; const body=JSON.stringify(event);
  const timestamp=String(Math.floor(Date.now()/1000)); const signature='v1='+createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
  let server=createWebhookReceiver({secret,directory}); server.listen(0,'127.0.0.1'); await once(server,'listening');
  async function call(raw=body,sig=signature){return fetch(`http://127.0.0.1:${server.address().port}/webhooks/magibooking`,{method:'POST',headers:{'x-magibooking-event-id':event.id,'x-magibooking-timestamp':timestamp,'x-magibooking-signature':sig},body:raw});}
  try {
    const responses=await Promise.all(Array.from({length:8},()=>call())); assert(responses.every(r=>r.status===200));
    assert.deepEqual(await readdir(directory),[event.id+'.json']);
    await new Promise(r=>server.close(r)); server=createWebhookReceiver({secret,directory}); server.listen(0,'127.0.0.1'); await once(server,'listening');
    assert.equal((await call()).status,200); assert.equal((await call(body+' ')).status,401);
    const different=JSON.stringify({...event,data:{different:true}});const signed='v1='+createHmac('sha256',secret).update(timestamp+'.'+different).digest('hex');assert.equal((await call(different,signed)).status,409);
  } finally { await new Promise(r=>server.close(r)); }
});
