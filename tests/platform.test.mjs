import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createSandbox } from '../sandbox/server.mjs';
import { MagiBooking } from '../packages/javascript/sandbox.mjs';

async function fixture(t, options) {
  const app = createSandbox(options);
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => new Promise(resolve => app.server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const client = merchantId => new MagiBooking({ baseUrl, merchantId, token: `sandbox_${merchantId}_local_only` });
  const body = { service_id: 'consultation', staff_id: 'staff_1', customer_reference: 'test_customer', start_at: new Date(Date.now() + 86400000).toISOString() };
  return { ...app, client, body };
}
test('merchant isolation covers catalog routes, appointments, events and cancellation', async t => {
  const f = await fixture(t); const a = f.client('alpha'); const b = f.client('beta');
  const item = await a.createAppointment(f.body, crypto.randomUUID());
  await assert.rejects(b.appointment(item.id), { status: 404 });
  await assert.rejects(b.request(`appointments/${item.id}/cancel`, { method: 'POST', body: {}, idempotencyKey: crypto.randomUUID() }), { status: 404 });
  assert.equal((await b.request('events')).data.length, 0);
  a.merchantId = 'beta'; await assert.rejects(a.services(), { status: 404 });
});
test('concurrent retries create one appointment and payload mismatch is rejected', async t => {
  const f = await fixture(t); const a = f.client('alpha'); const key = crypto.randomUUID();
  const items = await Promise.all(Array.from({ length: 12 }, () => a.createAppointment(f.body, key)));
  assert.equal(new Set(items.map(i => i.id)).size, 1);
  assert.equal(f.events.length, 1);
  await assert.rejects(a.createAppointment({ ...f.body, customer_reference: 'other' }, key), { status: 409 });
  await a.request(`appointments/${items[0].id}/cancel`, { method: 'POST', body: {}, idempotencyKey: crypto.randomUUID() });
  assert.equal((await a.createAppointment(f.body, key)).status, 'confirmed'); // Original response snapshot.
});
test('concurrent distinct requests cannot oversell, merchants have independent schedules', async t => {
  const f = await fixture(t); const a = f.client('alpha');
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => a.createAppointment(f.body, crypto.randomUUID())));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert(results.filter(r => r.status === 'rejected').every(r => r.reason.status === 409));
  assert.equal((await f.client('beta').createAppointment(f.body, crypto.randomUUID())).merchant_id, 'beta');
});
test('revocation blocks replay; subscription, scopes and quota are enforced', async t => {
  const f = await fixture(t, { quota: 2 }); const a = f.client('alpha');
  const key = crypto.randomUUID(); await a.createAppointment(f.body, key);
  const grant = [...f.grants.values()][0];
  grant.subscribed = false; await assert.rejects(a.createAppointment(f.body, key), { status: 403 }); grant.subscribed = true;
  grant.scopes = []; await assert.rejects(a.services(), { status: 403 }); grant.scopes = ['catalog:read', 'appointments:write'];
  await a.services(); await assert.rejects(a.services(), { status: 429 });
  f.revoke('alpha'); await assert.rejects(a.createAppointment(f.body, key), { status: 401 });
});
test('reminders are appointment bound, deduplicated; payment cannot be self-reported', async t => {
  const f = await fixture(t); const a = f.client('alpha');
  await assert.rejects(a.createAppointment({ ...f.body, payment_status: 'paid' }, crypto.randomUUID()), { status: 400 });
  const item = await a.createAppointment(f.body, crypto.randomUUID());
  const send = channel => a.request(`appointments/${item.id}/reminders`, { method: 'POST', body: { channel }, idempotencyKey: crypto.randomUUID() });
  await assert.rejects(send('sms'), { status: 403 });
  const key = crypto.randomUUID();
  for (let n = 0; n < 3; n++) await a.request(`appointments/${item.id}/reminders`, { method: 'POST', body: { channel: 'email' }, idempotencyKey: key });
  assert.equal(f.events.filter(e => e.type === 'notification.simulated').length, 1);
  const payment = await a.request(`appointments/${item.id}/payment-session`, { method: 'POST', body: {}, idempotencyKey: crypto.randomUUID() });
  assert.equal(payment.checkout_url, null);
  assert.equal((await a.request(`appointments/${item.id}/payment`)).status, 'unpaid');
});
test('rescheduling respects conflicts and cancelled appointments cannot be rescheduled', async t => {
  const f = await fixture(t); const a = f.client('alpha');
  const first = await a.createAppointment(f.body, crypto.randomUUID());
  const second = await a.createAppointment({ ...f.body, start_at: new Date(Date.parse(f.body.start_at) + 3600000).toISOString() }, crypto.randomUUID());
  const change = (op, body) => a.request(`appointments/${second.id}/${op}`, { method: 'POST', body, idempotencyKey: crypto.randomUUID() });
  await assert.rejects(change('reschedule', { start_at: first.start_at }), { status: 409 });
  await change('cancel', {});
  await assert.rejects(change('reschedule', { start_at: new Date(Date.now() + 172800000).toISOString() }), { status: 409 });
});
