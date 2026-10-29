"""Read-only scan of reachable Git blobs. Never emit matching secret values."""
from pathlib import Path
import json,re,subprocess,sys
patterns={
 'magi_credential':r'mb_(?:test|live|oauth|whsec)_[a-f0-9]{64}',
 'stripe_key':r'(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}',
 'webhook_secret':r'whsec_[A-Za-z0-9]{20,}',
 'github_token':r'gh[pousr]_[A-Za-z0-9]{20,}',
 'private_key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 'aws_key':r'AKIA[0-9A-Z]{16}',
 'private_path':r'/(?:Users|var/www)/[^\s]+',
}
def audit(repo):
 repo=Path(repo).resolve()
 def git(*args):return subprocess.check_output(['git',*args],cwd=repo)
 commits=git('rev-list','--all').decode().splitlines()
 objects=git('rev-list','--objects','--all').decode().splitlines();findings=[];blobs=0;paths=[]
 for row in objects:
  sha,_,name=row.partition(' ')
  if git('cat-file','-t',sha).strip()!=b'blob':continue
  blobs+=1;paths.append(name);text=git('cat-file','blob',sha).decode('utf8',errors='replace')
  for label,pattern in patterns.items():
   if re.search(pattern,text):findings.append({'object':sha,'path':name,'pattern':label})
  if any(part.startswith('.env')or part in ['.private-baseline','.codex-tmp','webhook-events']or part.endswith('.private.json')for part in Path(name).parts):findings.append({'object':sha,'path':name,'pattern':'forbidden_path'})
 return{'passed':not findings,'commits':len(commits),'reachableBlobs':blobs,'head':git('rev-parse','HEAD').decode().strip(),'findings':findings,'scope':'All reachable refs/tags in the isolated clone; known patterns and forbidden paths only; not a universal secret guarantee'}
if __name__=='__main__':
 result=audit(sys.argv[1]);print(json.dumps(result,indent=2));raise SystemExit(0 if result['passed']else 1)
