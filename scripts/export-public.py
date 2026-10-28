"""Export only reviewed public integration files. Never copy the working tree wholesale."""
import hashlib,json,re,shutil,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'dist/public'
if out.exists():raise SystemExit('Choose a new output directory; no overwrites')
files=['LICENSE','SECURITY.md','package.json','.gitignore','docs/QUICKSTART.md','docs/PUBLIC-README.md','docs/OAUTH-MCP.md','.github/workflows/ci.yml']
for directory in ['packages','openapi','examples','sandbox','tests','scripts']:
 files += [str(p.relative_to(root)) for p in (root/directory).rglob('*') if p.is_file() and not any(x in p.parts for x in ['__pycache__','build','dist','node_modules']) and p.suffix not in ['.pyc','.tgz'] and not any(x.endswith('.egg-info') for x in p.parts)]
files=sorted(set(files));patterns=[r'(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}',r'whsec_[A-Za-z0-9]{20,}',r'gh[pousr]_[A-Za-z0-9]{20,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'AKIA[0-9A-Z]{16}',r'/'+'Users/'+r'[^\s]+',r'/'+'var/www/'+r'[^\s]+',r'acct_[A-Za-z0-9]{12,}']
def scan(name,raw):
 text=raw.decode('utf8')
 if any(re.search(pattern,text) for pattern in patterns):raise SystemExit('Sensitive-pattern review required: '+name)
 if any(part.startswith('.env') or part in ['.private-baseline','.stage3-audit','.git','node_modules'] for part in Path(name).parts):raise SystemExit('Forbidden export path: '+name)
for name in files:scan(name,(root/name).read_bytes())
readme=(root/'docs/PUBLIC-README.md').read_bytes();scan('README.md',readme)
# Audit all reachable public-export history. The source workspace currently has no commits.
rev=subprocess.run(['git','rev-list','--all'],cwd=root,capture_output=True,text=True,check=True).stdout.splitlines()
for commit in rev:
 for name in files+['README.md']:
  r=subprocess.run(['git','show',commit+':'+name],cwd=root,capture_output=True)
  if r.returncode==0:scan(name,r.stdout)
out.mkdir(parents=True)
for name in files:
 target=out/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,target)
(out/'README.md').write_bytes(readme)
manifest={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file()}
(root/'.stage3-audit').mkdir(exist_ok=True)
(root/'.stage3-audit/export-audit.json').write_text(json.dumps({'files':manifest,'reachableSourceCommitsScanned':len(rev),'secretPatternMatches':0,'privateCloudSourceIncluded':False},indent=2))
print(json.dumps({'exportedFiles':len(manifest),'reachableSourceCommitsScanned':len(rev),'secretPatternMatches':0}))
