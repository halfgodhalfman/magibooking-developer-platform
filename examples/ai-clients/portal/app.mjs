const buttons=[...document.querySelectorAll('[data-client]')];
for(const button of buttons)button.addEventListener('click',()=>{
  for(const b of buttons){const selected=b===button;b.setAttribute('aria-pressed',String(selected));document.getElementById('client-'+b.dataset.client).hidden=!selected;}
});
document.getElementById('copy-endpoint').addEventListener('click',async()=>{
  const status=document.getElementById('copy-status');
  try{await navigator.clipboard.writeText(document.getElementById('endpoint').textContent);status.textContent='Copied MCP URL';}catch{status.textContent='Select and copy the MCP URL shown above.';}
});
