import sys
from magibooking import MagiBooking, verify_webhook
api=MagiBooking('sdk_test_placeholder','merchant_test',sys.argv[1]);key='sdk_contract_test_key_0001';v={'idempotency_key':key,'if_match':'"2026-10-28T12:00:00.000Z"'}
api.services();api.staff();api.availability(date='2026-11-01',service_id='service_test',staff_id='staff_test');api.create_appointment({'service_id':'service_test','staff_id':'staff_test','start_at':'2026-11-01T12:00:00Z','new_client':{'name':'Test','phone':'+12025550123'}},key);api.appointment('appointment_test');api.reschedule_appointment('appointment_test',{'start_at':'2026-11-02T12:00:00Z','staff_id':'staff_test'},**v);api.cancel_appointment('appointment_test',{},**v);api.payments('appointment_test');api.checkout('appointment_test',key);api.reminders('appointment_test');api.send_reminder('appointment_test','email',key);api.payment_setup();api.create_service({'name':'Test','price':'10.00','duration_minutes':30},key);api.update_service('service_test',{'price':'11.00'},**v);api.create_staff({'name':'Test'},key);api.update_staff('staff_test',{'title':'Test'},**v)
import hmac,hashlib
body=b'{"id":"test"}';timestamp='1793188800';sig='v1='+hmac.new(b'test-signing-secret',timestamp.encode()+b'.'+body,hashlib.sha256).hexdigest()
assert verify_webhook('test-signing-secret',timestamp,sig,body,int(timestamp))
assert not verify_webhook('test-signing-secret',timestamp,sig,body+b' ',int(timestamp))
assert not verify_webhook('test-signing-secret',timestamp,sig,body,int(timestamp)+301)
for origin in ['http://example.com','ftp://localhost','https://example.com/path','https://user:password@example.com']:
 try:MagiBooking('test','merchant_test',origin)
 except ValueError:pass
 else:raise AssertionError('Unsafe origin accepted')
