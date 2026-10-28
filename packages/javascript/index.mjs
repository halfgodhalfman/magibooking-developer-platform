/** Server-only cloud API client. No automatic retries of writes. */
export class MagiBookingError extends Error {
  constructor(code, {status, requestId} = {}) { super(code); this.name='MagiBookingError'; this.code=code; this.status=status; this.requestId=requestId; }
}
const id = value => { if (typeof value!=='string'||! /^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError('Invalid resource ID'); return value; };
export class MagiBooking {
  constructor({token, merchantId, baseUrl, timeoutMs=15000}) {
    if (typeof window !== 'undefined') throw new Error('MagiBooking credentials must stay on your server');
    const url=new URL(baseUrl);
    if ((url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))||url.username||url.password||url.search||url.hash||url.pathname!=='/') throw new TypeError('Use an HTTPS origin (HTTP loopback allowed for tests)');
    if(typeof token!=='string'||!token||/[\r\n]/.test(token))throw new TypeError('Token required');
    if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new TypeError('Invalid timeout');
    this.token=token;this.merchantId=id(merchantId);this.baseUrl=url.origin;this.timeoutMs=timeoutMs;
  }
  async request(path,{method='GET',body,idempotencyKey,ifMatch,query}={}) {
    if(!/^[A-Za-z0-9_/-]+$/.test(path)||path.includes('..')||path.startsWith('/'))throw new TypeError('Invalid resource path');
    if(body!==undefined&&!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey||''))throw new TypeError('A stable idempotency key of 16–128 characters is required');
    const url=new URL(`${this.baseUrl}/api/developer/v1/merchants/${id(this.merchantId)}/${path}/`);
    for(const [key,value] of Object.entries(query||{}))if(value!==undefined)url.searchParams.set(key,String(value));
    const response=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(this.timeoutMs),headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{}),...(ifMatch?{'If-Match':ifMatch}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    let data;try{data=await response.json();}catch{throw new MagiBookingError('INVALID_RESPONSE',{status:response.status,requestId:response.headers.get('x-request-id')});}
    if(!response.ok)throw new MagiBookingError(data.error?.code||'API_ERROR',{status:response.status,requestId:data.error?.request_id||response.headers.get('x-request-id')});
    return data;
  }
  services(){return this.request('services');}
  staff(){return this.request('staff');}
  availability(query){return this.request('availability',{query});}
  createAppointment(body,key){return this.request('appointments',{method:'POST',body,idempotencyKey:key});}
  appointment(appointmentId){return this.request(`appointments/${id(appointmentId)}`);}
  rescheduleAppointment(appointmentId,body,{idempotencyKey,ifMatch}){return this.request(`appointments/${id(appointmentId)}/reschedule`,{method:'POST',body,idempotencyKey,ifMatch});}
  cancelAppointment(appointmentId,body,{idempotencyKey,ifMatch}){return this.request(`appointments/${id(appointmentId)}/cancel`,{method:'POST',body,idempotencyKey,ifMatch});}
  payments(appointmentId){return this.request(`appointments/${id(appointmentId)}/payments`);}
  checkout(appointmentId,key){return this.request(`appointments/${id(appointmentId)}/checkout`,{method:'POST',body:{},idempotencyKey:key});}
  reminders(appointmentId){return this.request(`appointments/${id(appointmentId)}/reminders`);}
  sendReminder(appointmentId,channel,key){return this.request(`appointments/${id(appointmentId)}/reminders`,{method:'POST',body:{channel},idempotencyKey:key});}
  paymentSetup(){return this.request('payments/setup');}
  createService(body,key){return this.request('services',{method:'POST',body,idempotencyKey:key});}
  updateService(serviceId,body,{idempotencyKey,ifMatch}){return this.request(`services/${id(serviceId)}`,{method:'PATCH',body,idempotencyKey,ifMatch});}
  createStaff(body,key){return this.request('staff',{method:'POST',body,idempotencyKey:key});}
  updateStaff(staffId,body,{idempotencyKey,ifMatch}){return this.request(`staff/${id(staffId)}`,{method:'PATCH',body,idempotencyKey,ifMatch});}
}
