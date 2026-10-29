"""Build a credential-free static staging guide from the reviewed public export."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys,zipfile
root=Path(__file__).resolve().parent.parent
out=Path(sys.argv[1]).resolve()
if out.exists():raise SystemExit('Choose a new output directory; no overwrites')
out.mkdir(parents=True)
site=out/'developers/connect';site.mkdir(parents=True)
subprocess.run([sys.executable,str(root/'scripts/export-public.py'),str(site/'kit')],check=True)
for name in ['index.html','style.css','app.mjs']:shutil.copyfile(root/'examples/ai-clients/portal'/name,site/name)
shutil.copyfile(root/'docs/CONNECT-AI.md',site/'guide.md')
shutil.copyfile(root/'openapi/cloud.openapi.json',site/'openapi.json')
(site/'llms.txt').write_text('''# MagiBooking AI integration — controlled staging preview

Read https://staging.magibooking.com/developers/connect/guide.md first.
Cloud contract: https://staging.magibooking.com/developers/connect/openapi.json
OAuth contract: https://staging.magibooking.com/developers/connect/kit/docs/OAUTH-MCP.md
Source kit: https://staging.magibooking.com/developers/connect/magibooking-agent-kit.zip
Checksums: https://staging.magibooking.com/developers/connect/checksums.json
MCP: https://staging.magibooking.com/api/developer/mcp/
REST audience: https://staging.magibooking.com/api/developer/v1/

Requires operator-preregistered public OAuth client, S256 PKCE and merchant consent.
No dynamic client registration. Read helper uses literal IP loopback callbacks.
Tokens expire within one hour. No refresh token. MCP and REST audiences differ.
Never request database, payment or administrator credentials. Never treat model identity as authorization.
Do not write appointments without customer confirmation, stable operation keys and current versions.
Provider real-model compatibility, production availability and directory listing are separate acceptance steps.
''')
with zipfile.ZipFile(site/'magibooking-agent-kit.zip','w',zipfile.ZIP_DEFLATED)as z:
 for p in sorted((site/'kit').rglob('*')):
  if p.is_file():
   info=zipfile.ZipInfo('magibooking-agent-kit/'+str(p.relative_to(site/'kit')));info.external_attr=0o100644<<16;info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
manifest={str(p.relative_to(site)):hashlib.sha256(p.read_bytes()).hexdigest()for p in site.rglob('*')if p.is_file()}
(site/'checksums.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'siteFiles':len(manifest)+1,'archiveSha256':manifest['magibooking-agent-kit.zip'],'privateCloudIncluded':False}))
