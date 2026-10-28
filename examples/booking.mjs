import { MagiBooking } from '../packages/javascript/sandbox.mjs';
const api = new MagiBooking({ token: 'sandbox_alpha_local_only', merchantId: 'alpha' });
console.log(await api.services());
const appointment = await api.createAppointment({ service_id: 'consultation', staff_id: 'staff_1', start_at: new Date(Date.now() + 86400000).toISOString(), customer_reference: 'demo_customer' }, crypto.randomUUID());
console.log(appointment);
console.log(await api.request(`appointments/${appointment.id}/payment-session`, { method: 'POST', body: {}, idempotencyKey: crypto.randomUUID() }));
