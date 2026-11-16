const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,existsSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const storage=require('../dist/common/storage');

const env={...process.env};
const realFetch=global.fetch;
afterEach(()=>{process.env={...env};global.fetch=realFetch;});

test('local store writes once, reads back and removes',async()=>{
  delete process.env.STORAGE_PROVIDER;
  const dir=mkdtempSync(join(tmpdir(),'sme-store-'));
  try {
    await storage.writeStored(dir,'a1',Buffer.from('hello'));
    await assert.rejects(storage.writeStored(dir,'a1',Buffer.from('again')));
    assert.equal((await storage.readStored(dir,'a1')).toString(),'hello');
    await storage.removeStored(dir,'a1');
    assert.equal(existsSync(join(dir,'a1')),false);
    await assert.rejects(storage.readStored(dir,'a1'));
  } finally {rmSync(dir,{recursive:true,force:true});}
});

function supabase() {
  const root=mkdtempSync(join(tmpdir(),'sme-root-'));
  Object.assign(process.env,{STORAGE_PROVIDER:'supabase',UPLOAD_ROOT:root,SUPABASE_URL:'https://demo.supabase.co/',SUPABASE_SERVICE_ROLE_KEY:'secret-service-key',SUPABASE_STORAGE_BUCKET:'sme-docs'});
  const calls=[];
  return {root,calls,respond(fn){global.fetch=async(url,init={})=>{calls.push({url:String(url),init});return fn(String(url),init);};}};
}

test('supabase store maps the local folder to an object path and never overwrites',async()=>{
  const s=supabase();
  s.respond(()=>new Response('{}',{status:200}));
  await storage.writeStored(join(s.root,'supplements'),'f-1',Buffer.from('pdf'));
  const [call]=s.calls;
  assert.equal(call.url,'https://demo.supabase.co/storage/v1/object/sme-docs/supplements/f-1');
  assert.equal(call.init.method,'POST');
  assert.equal(call.init.headers['x-upsert'],'false');
  assert.equal(call.init.headers.Authorization,'Bearer secret-service-key');
  assert.ok(call.init.signal,'request carries a deadline');
});

test('supabase store downloads private objects and removes them',async()=>{
  const s=supabase();
  s.respond((url,init)=>init.method==='DELETE'?new Response('[]',{status:200}):new Response(Buffer.from('bytes'),{status:200}));
  assert.equal((await storage.readStored(s.root,'doc-1')).toString(),'bytes');
  assert.equal(s.calls[0].url,'https://demo.supabase.co/storage/v1/object/authenticated/sme-docs/doc-1');
  await storage.removeStored(s.root,'doc-1');
  assert.equal(s.calls[1].init.method,'DELETE');
  assert.equal(s.calls[1].url,'https://demo.supabase.co/storage/v1/object/sme-docs/doc-1');
});

test('supabase failures reject without leaking the service key',async()=>{
  const s=supabase();
  s.respond(()=>new Response('{"error":"Duplicate"}',{status:409}));
  await assert.rejects(storage.writeStored(s.root,'dup',Buffer.from('x')),e=>!String(e.message).includes('secret-service-key'));
  s.respond(()=>new Response('not found',{status:404}));
  await assert.rejects(storage.readStored(s.root,'missing'));
});

test('supabase store refuses paths outside the upload root and missing configuration',async()=>{
  const s=supabase();
  s.respond(()=>new Response('{}',{status:200}));
  await assert.rejects(storage.writeStored(join(s.root,'..'),'escape',Buffer.from('x')));
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await assert.rejects(storage.readStored(s.root,'doc'),e=>/Supabase Storage/.test(e.message));
  assert.equal(s.calls.length,0);
});
