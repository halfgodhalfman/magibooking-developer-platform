"""Compatibility fixtures from inspected production serializers, using synthetic data only."""
import copy,json
from pathlib import Path
from jsonschema import Draft202012Validator

contract=json.loads(Path('openapi/cloud.openapi.json').read_text())
base='/api/developer/v1/merchants/{merchantId}/'
def validator(path,method='get',status='200'):
 schema=contract['paths'][base+path+'/'][method]['responses'][status]['content']['application/json']['schema']
 return Draft202012Validator({'$ref':'#/response','response':schema,'components':contract['components']})

service={'id':'service_test','name':'Synthetic service','duration_minutes':30,'price':'10.00','currency':'USD','payment_mode':'BOOK_ONLY'}
staff={'id':'staff_test','name':'Synthetic staff','title':None}
stamp='2026-10-29T12:00:00.000Z'
checks=0
for item in [service,{**service,'deposit_amount':None,'deposit_percent':None,'updated_at':stamp}]:
 validator('services').validate({'data':[item],'location_id':'location_test'});checks+=1
for item in [staff,{**staff,'updated_at':stamp}]:
 validator('staff').validate({'data':[item],'location_id':'location_test'});checks+=1
appointment={'id':'appointment_test','appointment_number':'QA-001','location_id':'location_test','status':'CONFIRMED','start_at':stamp,'end_at':'2026-10-29T12:30:00.000Z','updated_at':stamp}
validator('appointments','post','201').validate({'appointment':appointment});checks+=1
validator('appointments/{appointmentId}').validate({'appointment':{**appointment,'payment_status':'UNPAID'}});checks+=1
# New preview writes still require a usable version; optional catalog fields must
# not silently weaken the response used to prepare If-Match.
for name,payload in [('services',{'service':{**service,'allow_online_booking':True}}),('staff',{'staff':{**staff,'allow_client_booking':True}})]:
 assert list(validator(name,'post','201').iter_errors(payload)),name
 checks+=1
missing_core=copy.deepcopy(service);del missing_core['price']
assert list(validator('services').iter_errors({'data':[missing_core],'location_id':'location_test'}));checks+=1
create=contract['paths'][base+'appointments/']['post'];assert create['x-release-status']=='production'and create['x-preview-features'];checks+=1
print(f'{checks} production/preview response compatibility checks passed')
