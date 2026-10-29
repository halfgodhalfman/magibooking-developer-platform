import test from'node:test';import assert from'node:assert/strict';
test('cloud demo keeps credentials server-side and blocks unsafe browser writes',async()=>{
 Object.assign(process.env,{PORT:'0',MAGI_API_ORIGIN:'https://staging.magibooking.com',MAGI_API_TOKEN:'demo-test-placeholder-not-a-credential',MAGI_MERCHANT_ID:'demo_merchant'});
 const {server}=await import('../examples/cloud-website/server.mjs');if(!server.listening)await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{for(const p of ['/','/app.mjs']){const r=await fetch(base+p);assert.equal(r.status,200);assert.ok(!(await r.text()).includes(process.env.MAGI_API_TOKEN));assert.equal(r.headers.get('cache-control'),'no-store');}
 assert.equal((await fetch(base+'/missing')).status,404);
 assert.equal((await fetch(base+'/api/appointments',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'},body:'{}'})).status,403);
 const invalid=await fetch(base+'/api/appointments',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({new_client:{name:'Real customer',phone:'+19999999999',email:'real@example.com'}})});assert.equal(invalid.status,400);assert.equal((await invalid.json()).error.code,'SYNTHETIC_CUSTOMER_REQUIRED');
 const bad=await fetch(base+'/api/appointments',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'not-json'});assert.equal(bad.status,400);
 }finally{await new Promise(r=>server.close(r));}
});
