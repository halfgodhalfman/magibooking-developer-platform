// Run behind HTTPS termination, using a durable data directory. Acknowledge only after journaling.
import { createServer } from 'node:http';
import { mkdir, open, link, unlink, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyMagiBookingWebhook } from '../../packages/javascript/webhooks.mjs';

export function createWebhookReceiver({ secret, directory }) {
  if (!/^mb_whsec_[a-f0-9]{64}$/.test(secret || '')) throw new Error('Webhook signing secret required');
  const root = resolve(directory);
  return createServer(async (req, res) => {
    let temp;
    try {
      if (req.method !== 'POST' || req.url !== '/webhooks/magibooking') { res.writeHead(404).end(); return; }
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 65536) { res.writeHead(413).end(); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      if (!verifyMagiBookingWebhook({ secret, timestamp: req.headers['x-magibooking-timestamp'], signature: req.headers['x-magibooking-signature'], rawBody: body })) { res.writeHead(401).end(); return; }
      const event = JSON.parse(body.toString('utf8'));
      if (typeof event.id !== 'string' || !/^[a-f0-9-]{36}$/.test(event.id) || req.headers['x-magibooking-event-id'] !== event.id || !['appointment.created','appointment.rescheduled','appointment.cancelled','payment.succeeded','payment.failed'].includes(event.type)) { res.writeHead(400).end(); return; }
      await mkdir(root, { recursive: true, mode: 0o700 });
      temp = join(root, '.pending-' + randomUUID()); const target = join(root, event.id + '.json');
      const file = await open(temp, 'wx', 0o600);
      try { await file.writeFile(body); await file.sync(); } finally { await file.close(); }
      try { await link(temp, target); } catch (error) { if (error.code !== 'EEXIST') throw error; if (!(await readFile(target)).equals(body)) { res.writeHead(409).end(); return; } }
      await unlink(temp); temp = undefined;
      const dir = await open(root, 'r'); try { await dir.sync(); } finally { await dir.close(); }
      // A separate consumer may now process the journal using event.id as its idempotency key.
      res.writeHead(200).end();
    } catch { res.writeHead(500).end(); }
    finally { if (temp) await unlink(temp).catch(() => {}); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createWebhookReceiver({ secret: process.env.MAGI_WEBHOOK_SIGNING_SECRET, directory: process.env.MAGI_WEBHOOK_DATA_DIR || './webhook-events' }).listen(Number(process.env.PORT || 4328), '127.0.0.1');
}
