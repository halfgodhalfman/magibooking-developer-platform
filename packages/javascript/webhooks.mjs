// Server-side Node.js helper. Verify the exact received bytes before parsing JSON.
import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyMagiBookingWebhook({ secret, timestamp, signature, rawBody, now = Date.now() }) {
  if (typeof secret !== 'string' || !secret || typeof timestamp !== 'string' || !/^\d{10,12}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || typeof signature !== 'string' || !/^v1=[a-f0-9]{64}$/.test(signature) || !(Buffer.isBuffer(rawBody) || typeof rawBody === 'string')) return false;
  const expected = 'v1=' + createHmac('sha256', secret).update(timestamp + '.').update(rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
