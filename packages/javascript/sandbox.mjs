export class MagiBooking {
  constructor({ token, merchantId, baseUrl = 'http://127.0.0.1:4310' }) {
    this.token = token; this.merchantId = merchantId; this.baseUrl = baseUrl.replace(/\/$/, '');
    if (new URL(this.baseUrl).protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(this.baseUrl).hostname)) throw new Error('HTTPS required');
  }
  async request(path, { method = 'GET', body, idempotencyKey } = {}) {
    if (!/^[a-zA-Z0-9_/-]+$/.test(path) || path.includes('..')) throw new Error('Invalid resource path');
    const response = await fetch(`${this.baseUrl}/v1/merchants/${encodeURIComponent(this.merchantId)}/${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error?.code || 'API_ERROR'), { status: response.status, requestId: data.error?.request_id });
    return data;
  }
  services() { return this.request('services'); }
  createAppointment(body, idempotencyKey) { return this.request('appointments', { method: 'POST', body, idempotencyKey }); }
  appointment(id) { return this.request(`appointments/${encodeURIComponent(id)}`); }
}
