export interface VersionedWrite {idempotencyKey:string; ifMatch:string}
export interface Appointment {id:string;appointment_number:string;location_id:string;status:string;payment_status?:string;start_at:string;end_at:string;updated_at:string}
export interface AppointmentResponse {appointment:Appointment;payment?:{effect_id:string;state:string;status_url:string}}
export interface NewClient {name:string;phone:string;email?:string|null}
export type CreateAppointment = {service_id:string;staff_id:string;location_id?:string;start_at:string} & ({client_id:string;new_client?:never}|{new_client:NewClient;client_id?:never});
export interface ServiceWrite {name?:string;price?:string;duration_minutes?:number;buffer_before_minutes?:number;buffer_after_minutes?:number;allow_online_booking?:boolean;payment_mode?:'BOOK_ONLY'|'FULL_PAYMENT'|'DEPOSIT_FIXED'|'DEPOSIT_PERCENT';deposit_amount?:string;deposit_percent?:string}
export interface Service {id:string;name:string;price:string;currency:string;duration_minutes:number;payment_mode:string;deposit_amount?:string|null;deposit_percent?:string|null;updated_at?:string}
export interface VersionedService extends Service {deposit_amount:string|null;deposit_percent:string|null;updated_at:string;allow_online_booking:boolean}
export interface StaffWrite {name?:string;title?:string|null;allow_client_booking?:boolean;service_ids?:string[];schedules?:{weekday:number;start_time:string;end_time:string}[]}
export interface Staff {id:string;name:string;title:string|null;updated_at?:string}
export interface VersionedStaff extends Staff {updated_at:string;allow_client_booking:boolean}
export interface EffectResponse {effect:{id:string;status:string}|null}
export interface PaymentResponse {amount:string|null;currency:string|null;payment_status:string;checkout_state:string;checkout_url:string|null;expires_at:string|null;merchant_setup_url:string}
export class MagiBookingError extends Error {code:string;status?:number;requestId?:string;constructor(code:string,options?:{status?:number;requestId?:string})}
export class MagiBooking {
 constructor(options:{token:string;merchantId:string;baseUrl:string;timeoutMs?:number});
 services():Promise<{data:Service[];location_id:string}>;
 staff():Promise<{data:Staff[];location_id:string}>;
 availability(query:{date:string;service_id:string;staff_id:string}):Promise<{location_id:string;timezone:string;data:{start_at:string;staff_id:string}[];reasons:string[]}>;
 createAppointment(body:CreateAppointment,key:string):Promise<AppointmentResponse>;
 appointment(id:string):Promise<AppointmentResponse>;
 rescheduleAppointment(id:string,body:{start_at:string;staff_id:string},options:VersionedWrite):Promise<AppointmentResponse>;
 cancelAppointment(id:string,body:{reason?:string},options:VersionedWrite):Promise<AppointmentResponse>;
 payments(id:string):Promise<PaymentResponse>;
 checkout(id:string,key:string):Promise<EffectResponse>;
 reminders(id:string):Promise<{data:{id:string;kind:'EMAIL'|'SMS';status:string;attempts:number;errorCode:string|null;nextAttemptAt:string|null}[]}>;
 sendReminder(id:string,channel:'email'|'sms',key:string):Promise<EffectResponse>;
 paymentSetup():Promise<{merchant_setup_url:string}>;
 createService(body:ServiceWrite & {name:string;price:string;duration_minutes:number},key:string):Promise<{service:VersionedService}>;
 updateService(id:string,body:ServiceWrite,options:VersionedWrite):Promise<{service:VersionedService}>;
 createStaff(body:StaffWrite & {name:string},key:string):Promise<{staff:VersionedStaff}>;
 updateStaff(id:string,body:StaffWrite,options:VersionedWrite):Promise<{staff:VersionedStaff}>;
 request(path:string,options?:{method?:string;body?:unknown;idempotencyKey?:string;ifMatch?:string;query?:Record<string,string>}):Promise<unknown>;
}
