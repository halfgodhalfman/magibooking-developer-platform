// Server-side only. Set an explicitly approved cloud origin; preview endpoints require staging.
import {MagiBooking} from '../packages/javascript/index.mjs';
const api=new MagiBooking({baseUrl:process.env.MAGI_API_ORIGIN,token:process.env.MAGI_API_TOKEN,merchantId:process.env.MAGI_MERCHANT_ID});
console.log(await api.services());console.log(await api.staff());
// Creation is an explicit opt-in; do not book on script startup.
if(process.env.MAGI_CREATE_TEST_BOOKING==='true'){
 const fs=await import('node:fs/promises');
 const body=JSON.parse(await fs.readFile(process.env.MAGI_BOOKING_INPUT_FILE,'utf8'));
 if(!process.env.MAGI_IDEMPOTENCY_KEY)throw Error('Persist a stable key before running');
 const result=await api.createAppointment(body,process.env.MAGI_IDEMPOTENCY_KEY);
 console.log({appointmentId:result.appointment.id,status:result.appointment.status});
 console.log(await api.payments(result.appointment.id));
}
