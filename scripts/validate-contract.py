"""Optional independent OpenAPI/schema validation: pip install -r tests/requirements.txt."""
import json,sys
from pathlib import Path
from openapi_spec_validator import validate
from jsonschema import Draft202012Validator
for name in ['cloud','sandbox']:
 validate(json.loads(Path(f'openapi/{name}.openapi.json').read_text()))
validate(json.loads(Path('openapi/webhooks.json').read_text()))
c=json.loads(Path('openapi/cloud.openapi.json').read_text());count=0
for p in Path(sys.argv[1]).glob('requests-*.json') if len(sys.argv)>1 else []:
 from urllib.parse import urlparse,parse_qs
 for r in json.loads(p.read_text()):
  u=urlparse(r['url']);path=u.path
  for value,key in [('merchant_test','merchantId'),('appointment_test','appointmentId'),('service_test','serviceId'),('staff_test','staffId')]:path=path.replace('/'+value+'/', '/{'+key+'}/')
  op=c['paths'][path][r['method'].lower()]
  if 'requestBody' in op:
   schema={'$ref':'#/operation','operation':op['requestBody']['content']['application/json']['schema'],'components':c['components']}
   Draft202012Validator(schema).validate(r['body'])
  q=parse_qs(u.query)
  for param in op['parameters']:
   if param['in']=='header':value=r['headers'].get(param['name'].lower())
   elif param['in']=='query':value=q.get(param['name'],[None])[0]
   else:continue
   if param.get('required'):assert value is not None,param['name']
   if value is not None:Draft202012Validator(param['schema']).validate(value)
  count+=1
print(f'OpenAPI documents valid; {count} SDK HTTP requests schema-validated')
