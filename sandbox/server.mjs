import http from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Local demonstration only. Never deploy this in-memory implementation.
export function createSandbox({ quota = 1000 } = {}) {
  const grants = new Map();
  const appointments = new Map();
  const requests = new Map();
  const events = [];
  const audit = [];
  const digest = value => createHash('sha256').update(value).digest('hex');
  for (const merchant of ['alpha', 'beta']) {
    const token = `sandbox_${merchant}_local_only`;
    grants.set(digest(token), { merchant, active: true, subscribed: true, used: 0,
      scopes: ['catalog:read', 'availability:read', 'appointments:read', 'appointments:write', 'payments:read', 'payments:write', 'notifications:write', 'events:read'] });
  }
  const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
  const handler = async (req, res) => {
    const requestId = randomUUID();
    const send = (status, data, extra = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Request-Id': requestId, ...extra });
      res.end(JSON.stringify(data));
    };
    let grant;
    try {
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail(403, 'LOCAL_ONLY');
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health' && req.method === 'GET') return send(200, { mode: 'sandbox', persistent: false, real_payments: false, real_messages: false });
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const tokenHash = digest(token);
      grant = [...grants.entries()].find(([hash]) => timingSafeEqual(Buffer.from(hash), Buffer.from(tokenHash)))?.[1];
      if (!grant?.active) fail(401, 'INVALID_TOKEN');
      const match = url.pathname.match(/^\/v1\/merchants\/([^/]+)\/(.+)$/);
      if (!match || match[1] !== grant.merchant) fail(404, 'NOT_FOUND');
      if (!grant.subscribed) fail(403, 'SUBSCRIPTION_REQUIRED');
      const route = match[2];
      const method = req.method;
      const scope = route === 'services' || route === 'staff' ? 'catalog:read'
        : route === 'availability' ? 'availability:read'
        : route === 'events' ? 'events:read'
        : route.endsWith('/payment-session') ? 'payments:write'
        : route.endsWith('/payment') ? 'payments:read'
        : route.endsWith('/reminders') ? 'notifications:write'
        : method === 'GET' ? 'appointments:read' : 'appointments:write';
      if (!grant.scopes.includes(scope)) fail(403, 'INSUFFICIENT_SCOPE');
      const mutating = ['POST', 'PATCH', 'DELETE'].includes(method);
      let body = {};
      if (mutating) {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 16384) fail(413, 'BODY_TOO_LARGE');
        }
        try { body = raw ? JSON.parse(raw) : {}; } catch { fail(400, 'INVALID_JSON'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_BODY');
      }
      // Recheck after awaiting input: revocation and subscription changes take effect.
      if (!grant.active) fail(401, 'INVALID_TOKEN');
      if (!grant.subscribed) fail(403, 'SUBSCRIPTION_REQUIRED');
      const key = req.headers['idempotency-key'];
      if (mutating && (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key))) fail(400, 'IDEMPOTENCY_KEY_REQUIRED');
      const cacheKey = `${tokenHash}:${key}`;
      const fingerprint = digest(JSON.stringify([method, url.pathname, body]));
      const prior = mutating && requests.get(cacheKey);
      if (prior) {
        if (prior.fingerprint !== fingerprint) fail(409, 'IDEMPOTENCY_CONFLICT');
        return send(prior.status, prior.data, { 'Idempotency-Replayed': 'true' });
      }
      if (grant.used >= quota) fail(429, 'QUOTA_EXCEEDED');
      grant.used++;
      let status = 200;
      let data;
      const event = (type, item) => events.push({ id: randomUUID(), type, merchant_id: grant.merchant, appointment_id: item.id, occurred_at: new Date().toISOString(), simulated: true });
      const getAppointment = id => {
        const item = appointments.get(id);
        if (!item || item.merchant_id !== grant.merchant) fail(404, 'NOT_FOUND');
        return item;
      };
      const validateSlot = (input, except) => {
        const start = Date.parse(input.start_at);
        if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.start_at || '') || !Number.isFinite(start) || start <= Date.now()) fail(400, 'INVALID_START_TIME');
        if (input.service_id !== 'consultation' || input.staff_id !== 'staff_1') fail(404, 'RESOURCE_NOT_FOUND');
        const end = start + 30 * 60000;
        if ([...appointments.values()].some(a => a.id !== except && a.merchant_id === grant.merchant && a.staff_id === input.staff_id && a.status !== 'cancelled' && start < Date.parse(a.end_at) && end > Date.parse(a.start_at))) fail(409, 'SCHEDULE_CONFLICT');
        return { start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString() };
      };
      // No await within state validation/mutation: atomic in this single-process demo.
      if (method === 'GET' && route === 'services') data = { data: [{ id: 'consultation', name: 'Sandbox consultation', duration_minutes: 30, price_minor: 5000, currency: 'USD' }] };
      else if (method === 'GET' && route === 'staff') data = { data: [{ id: 'staff_1', name: 'Sandbox staff', service_ids: ['consultation'] }] };
      else if (method === 'GET' && route === 'availability') {
        const start_at = url.searchParams.get('start_at');
        try { data = { available: true, ...validateSlot({ start_at, service_id: url.searchParams.get('service_id'), staff_id: url.searchParams.get('staff_id') }) }; }
        catch (error) { if (error.code !== 'SCHEDULE_CONFLICT') throw error; data = { available: false }; }
      }
      else if (method === 'GET' && route === 'events') data = { data: events.filter(e => e.merchant_id === grant.merchant) };
      else if (method === 'POST' && route === 'appointments') {
        if (Object.keys(body).some(k => !['service_id', 'staff_id', 'start_at', 'customer_reference'].includes(k))) fail(400, 'UNKNOWN_FIELD');
        if (typeof body.customer_reference !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(body.customer_reference)) fail(400, 'INVALID_CUSTOMER_REFERENCE');
        data = { id: randomUUID(), merchant_id: grant.merchant, service_id: body.service_id, staff_id: body.staff_id, customer_reference: body.customer_reference,
          ...validateSlot(body), status: 'confirmed', payment_status: 'unpaid', simulated: true };
        appointments.set(data.id, data); event('appointment.created', data); status = 201;
      } else {
        const parts = route.match(/^appointments\/([^/]+)(?:\/(reschedule|cancel|payment-session|payment|reminders))?$/);
        if (!parts) fail(404, 'NOT_FOUND');
        const item = getAppointment(parts[1]);
        if (method === 'GET' && !parts[2]) data = { ...item };
        else if (method === 'GET' && parts[2] === 'payment') data = { appointment_id: item.id, status: item.payment_status, simulated: true };
        else if (method === 'POST' && parts[2] === 'cancel') {
          item.status = 'cancelled'; data = { ...item }; event('appointment.cancelled', item);
        } else if (method === 'POST' && parts[2] === 'reschedule') {
          if (item.status === 'cancelled') fail(409, 'APPOINTMENT_CANCELLED');
          Object.assign(item, validateSlot({ ...item, start_at: body.start_at }, item.id)); data = { ...item }; event('appointment.rescheduled', item);
        } else if (method === 'POST' && parts[2] === 'payment-session') {
          if (item.status === 'cancelled') fail(409, 'APPOINTMENT_CANCELLED');
          data = { appointment_id: item.id, simulated: true, checkout_url: null, status: 'requires_merchant_payment_setup', message: 'Sandbox never collects funds.' };
        } else if (method === 'POST' && parts[2] === 'reminders') {
          if (item.status === 'cancelled') fail(409, 'APPOINTMENT_CANCELLED');
          if (body.channel !== 'email') fail(403, 'SMS_NOT_ENABLED');
          data = { appointment_id: item.id, delivery_status: 'simulated', channel: 'email' }; event('notification.simulated', item);
        } else fail(405, 'METHOD_NOT_ALLOWED');
      }
      const snapshot = structuredClone(data);
      if (mutating) requests.set(cacheKey, { fingerprint, status, data: snapshot });
      audit.push({ request_id: requestId, merchant_id: grant.merchant, method, route, status });
      send(status, snapshot);
    } catch (error) {
      audit.push({ request_id: requestId, merchant_id: grant?.merchant, status: error.status || 500, code: error.code || 'INTERNAL_ERROR' });
      send(error.status || 500, { error: { code: error.code || 'INTERNAL_ERROR', request_id: requestId } });
    }
  };
  return { server: http.createServer(handler), grants, audit, events, revoke(merchant) { for (const g of grants.values()) if (g.merchant === merchant) g.active = false; } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createSandbox().server.listen(4310, '127.0.0.1', () => console.log('MagiBooking LOCAL SANDBOX http://127.0.0.1:4310 — no real payments or messages'));
}
