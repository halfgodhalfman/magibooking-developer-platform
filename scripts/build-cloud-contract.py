"""Maintain the public contract from the reviewed private-cloud route inventory.
No private service implementation or credentials are copied into this repository.
"""
import json
from pathlib import Path
S=lambda **kw:dict(type='string',**kw)
ref=lambda n:{'$ref':'#/components/schemas/'+n}
def obj(props,required=(),strict=True):
 return dict(type='object',properties=props,required=list(required),**({'additionalProperties':False} if strict else {}))
nullable=lambda t:{'type':[t,'null']}
identifier=S(pattern='^[A-Za-z0-9_-]+$')
date=S(format='date-time')
price=S(pattern=r'^\d{1,8}(\.\d{1,2})?$')
service={'id':identifier,'name':S(),'price':price,'currency':S(),'duration_minutes':{'type':'integer'},'payment_mode':S(enum=['BOOK_ONLY','FULL_PAYMENT','DEPOSIT_FIXED','DEPOSIT_PERCENT']),'deposit_amount':nullable('string'),'deposit_percent':nullable('string'),'updated_at':date}
appointment=obj({'id':identifier,'appointment_number':S(),'location_id':S(),'status':S(),'payment_status':S(),'start_at':date,'end_at':date,'updated_at':date},['id','appointment_number','location_id','status','start_at','end_at','updated_at'])
serviceWrite={'name':S(minLength=1,maxLength=120),'price':price,'duration_minutes':{'type':'integer','minimum':1,'maximum':1440},'buffer_before_minutes':{'type':'integer','minimum':0,'maximum':1440},'buffer_after_minutes':{'type':'integer','minimum':0,'maximum':1440},'allow_online_booking':{'type':'boolean'},'payment_mode':service['payment_mode'],'deposit_amount':price,'deposit_percent':price}
staffWrite={'name':S(minLength=1,maxLength=120),'title':{'type':['string','null'],'maxLength':120},'allow_client_booking':{'type':'boolean'},'service_ids':{'type':'array','maxItems':100,'items':identifier},'schedules':{'type':'array','maxItems':7,'items':obj({'weekday':{'type':'integer','minimum':0,'maximum':6},'start_time':S(pattern=r'^([01]\d|2[0-3]):[0-5]\d$'),'end_time':S(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')},['weekday','start_time','end_time'])}}
schemas={'Error':obj({'error':obj({'code':S(),'request_id':S()},['code','request_id'])},['error']), 'Appointment':appointment,'AppointmentResponse':obj({'appointment':ref('Appointment'),'payment':obj({'effect_id':S(),'state':S(),'status_url':S()},['effect_id','state','status_url'])},['appointment']), 'Service':obj(service,['id','name','price','currency','duration_minutes','payment_mode']),'ServiceWrite':obj(serviceWrite),'StaffWrite':obj(staffWrite),'ServiceResponse':obj({'service':obj({**service,'allow_online_booking':{'type':'boolean'}},list(service)+['allow_online_booking'])},['service']), 'StaffResponse':obj({'staff':obj({'id':identifier,'name':S(),'title':nullable('string'),'allow_client_booking':{'type':'boolean'},'updated_at':date},['id','name','title','allow_client_booking','updated_at'])},['staff']), 'EffectResponse':obj({'effect':{'oneOf':[{'type':'null'},obj({'id':S(),'status':S()},['id','status'])]}},['effect']), 'PaymentResponse':obj({'amount':nullable('string'),'currency':nullable('string'),'payment_status':S(),'checkout_state':S(),'checkout_url':nullable('string'),'expires_at':nullable('string'),'merchant_setup_url':S(format='uri')},['amount','currency','payment_status','checkout_state','checkout_url','expires_at','merchant_setup_url'])}
create=obj({'client_id':identifier,'new_client':obj({'name':S(minLength=1,maxLength=120),'phone':S(maxLength=50),'email':nullable('string')},['name','phone']), 'service_id':identifier,'staff_id':identifier,'location_id':identifier,'start_at':date},['service_id','staff_id','start_at']);create['oneOf']=[{'required':['client_id'],'not':{'required':['new_client']}},{'required':['new_client'],'not':{'required':['client_id']}}];schemas['CreateAppointment']=create
base='/api/developer/v1/merchants/{merchantId}/'
paths={}
errors={str(code):{'description':desc,'content':{'application/json':{'schema':ref('Error')}}}for code,desc in [(400,'Invalid input or missing idempotency key'),(401,'Invalid or revoked credential'),(403,'Scope, role, subscription or entitlement denied'),(404,'Resource or location not accessible'),(409,'Policy, payment or schedule conflict; inspect error.code'),(412,'Version conflict; fetch current state'),(413,'Body exceeds 16384 bytes'),(415,'JSON required'),(428,'If-Match required'),(429,'Persistent quota exhausted'),(500,'Internal error'),(503,'Developer API disabled')]}
def add(path,method,name,scope,response,status=200,body=None,version=False,query=(),preview=True):
 params=[{'name':'merchantId','in':'path','required':True,'schema':identifier}]
 for part in ['appointmentId','serviceId','staffId']:
  if '{'+part+'}' in path:params.append({'name':part,'in':'path','required':True,'schema':identifier})
 if body is not None:params.append({'name':'Idempotency-Key','in':'header','required':True,'schema':S(pattern='^[A-Za-z0-9_-]{16,128}$'),'description':'Keep the same key and exact body/version when retrying the same operation. No automatic SDK write retries.'})
 if version:params.append({'name':'If-Match','in':'header','required':True,'schema':S(),'description':'Quoted updated_at value, e.g. "2026-10-28T12:00:00.000Z". Obtain from read/create response; stale versions return 412.'})
 params += [{'name':q,'in':'query','required':True,'schema':S(format='date') if q=='date' else identifier}for q in query]
 responses={**errors,str(status):{'description':'Success; see asynchronous state and release status','headers':{'X-Request-Id':{'schema':S()},'ETag':{'schema':S(),'description':'Present for appointment/catalog object responses'},'Idempotency-Replayed':{'schema':S(enum=['true'])}},'content':{'application/json':{'schema':response}}}}
 if name=='checkout':responses['200']=responses['202']
 op={'operationId':name,'summary':name,'x-required-scope':scope,'x-release-status':'staging-preview' if preview else 'production','security':[{'merchantBearer':[]}],'parameters':params,'responses':responses}
 if body is not None:op['requestBody']={'required':True,'content':{'application/json':{'schema':body}}}
 paths.setdefault(base+path+'/',{})[method]=op
add('services','get','services','catalog:read',obj({'data':{'type':'array','maxItems':100,'items':ref('Service')},'location_id':S()},['data','location_id']),preview=False)
add('staff','get','staff','catalog:read',obj({'data':{'type':'array','maxItems':100,'items':obj({'id':S(),'name':S(),'title':nullable('string'),'updated_at':date},['id','name','title'])},'location_id':S()},['data','location_id']),preview=False)
add('availability','get','availability','availability:read',obj({'location_id':S(),'timezone':S(),'data':{'type':'array','items':obj({'start_at':date,'staff_id':S()},['start_at','staff_id'])},'reasons':{'type':'array','items':S()}},['location_id','timezone','data','reasons']),query=['date','service_id','staff_id'],preview=False)
add('appointments','post','createAppointment','appointments:create',ref('AppointmentResponse'),201,ref('CreateAppointment'),preview=False)
paths[base+'appointments/']['post'].update({'description':'Production supports basic BOOK_ONLY appointments. Payment-required bookings and asynchronous payment preparation remain staging preview and require separate payment permissions. Preserve the original key and exact request after an unknown outcome.','x-preview-features':['payment-required bookings and asynchronous payment preparation']})
add('appointments/{appointmentId}','get','appointment','appointments:read',ref('AppointmentResponse'),preview=False)
add('appointments/{appointmentId}/reschedule','post','rescheduleAppointment','appointments:reschedule',ref('AppointmentResponse'),body=obj({'start_at':date,'staff_id':identifier},['start_at','staff_id']),version=True)
add('appointments/{appointmentId}/cancel','post','cancelAppointment','appointments:cancel',ref('AppointmentResponse'),body=obj({'reason':S()}),version=True)
add('appointments/{appointmentId}/payments','get','payments','payments:read',ref('PaymentResponse'))
add('appointments/{appointmentId}/checkout','post','checkout','payments:create',ref('EffectResponse'),202,obj({}))
add('appointments/{appointmentId}/reminders','get','reminders','appointments:read',obj({'data':{'type':'array','maxItems':100,'items':obj({'id':S(),'kind':S(enum=['EMAIL','SMS']),'status':S(),'attempts':{'type':'integer'},'errorCode':nullable('string'),'nextAttemptAt':nullable('string')},['id','kind','status','attempts','errorCode','nextAttemptAt'])}},['data']))
add('appointments/{appointmentId}/reminders','post','sendReminder','reminders:send',ref('EffectResponse'),202,obj({'channel':S(enum=['email','sms'])},['channel']))
add('payments/setup','get','paymentSetup','payments:read',obj({'merchant_setup_url':S(format='uri')},['merchant_setup_url']))
for kind,singular in [('services','Service'),('staff','Staff')]:
 body=ref(singular+'Write'); required=['name','price','duration_minutes']if kind=='services'else['name']
 add(kind,'post','create'+singular,'merchant:'+kind+':write',ref(singular+'Response'),201,{'allOf':[body,{'required':required}]})
 add(kind+'/{'+singular.lower()+'Id}','patch','update'+singular,'merchant:'+kind+':write',ref(singular+'Response'),body=body,version=True)
contract={'openapi':'3.1.0','info':{'title':'MagiBooking Cloud Developer API','version':'0.3.0-preview.1','description':'Reviewed against the 2026-10-28 private cloud OAuth/MCP staging candidate. Preview operations are not deployed to production. Merchant-created direct bearer credentials; OAuth authorization-code with mandatory S256 PKCE is a separate staging preview; production remains direct bearer only. Every call checks current merchant/location authorization, subscription and quota. Catalog is merchant-shared, at most 100 items without pagination. Catalog writes require explicit merchant-wide opt-in; payment policy fields additionally require merchant:payment-rules:write. All write bodies are limited to 16384 bytes. No arbitrary email/SMS sending or agent-declared payment success.'},'servers':[{'url':'https://staging.magibooking.com','description':'Staging preview: isolated test merchants and test data only.'},{'url':'https://www.magibooking.com','description':'Production: use only operations marked production; base appointment creation is available but paid preview is not.'}],'paths':paths,'components':{'securitySchemes':{'merchantBearer':{'type':'http','scheme':'bearer','description':'Keep merchant-issued token server-side; one explicit merchant/location grant. Production direct credentials; OAuth tokens for the exact API resource are supported in staging preview.'}},'schemas':schemas},'webhooks':json.loads(Path('openapi/webhooks.json').read_text())['webhooks']}
contract['components']['securitySchemes']['developerOAuth']={'type':'oauth2','x-release-status':'staging-preview','flows':{'authorizationCode':{'authorizationUrl':'https://staging.magibooking.com/api/developer/oauth/authorize/','tokenUrl':'https://staging.magibooking.com/api/developer/oauth/token/','scopes':{op['x-required-scope']:op['x-required-scope'] for path in paths.values() for op in path.values()}}}}
for path in paths.values():
 for op in path.values():
  op['security'].append({'developerOAuth':[op['x-required-scope']]});op['x-oauth-release-status']='staging-preview'
contract['components']['securitySchemes']['developerOAuth']['flows']['authorizationCode']['scopes']['merchant:payment-rules:write']='Edit shared merchant deposit and payment rules (separate explicit consent)'
contract['components']['schemas'].update(json.loads(Path('openapi/webhooks.json').read_text())['components']['schemas'])
Path('openapi/cloud.openapi.json').write_text(json.dumps(contract,indent=2)+'\n')
