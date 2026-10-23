const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {Prisma}=require('@prisma/client');
require('reflect-metadata');

// Compile source in memory so parallel workers never overwrite shared dist.
const previous=require.extensions['.ts'];
let PortalService,rules;
try {
  require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,experimentalDecorators:true,emitDecoratorMetadata:true},
  }).outputText,filename);
  ({PortalService}=require('../src/modules/portal/portal.service.ts'));
  rules=require('../src/modules/portal/portal.foundation.ts');
} finally {
  if(previous)require.extensions['.ts']=previous;else delete require.extensions['.ts'];
}
const key='11111111-1111-4111-8111-111111111111';
function preview(fn){return async()=>{
  const old=[process.env.NODE_ENV,process.env.PORTAL_FOUNDATION_PREVIEW];
  process.env.NODE_ENV='test';process.env.PORTAL_FOUNDATION_PREVIEW='true';
  try{await fn();}finally{for(const [i,name]of ['NODE_ENV','PORTAL_FOUNDATION_PREVIEW'].entries())if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i];}
};}
function fixture(existing){
  const rows=new Map(existing?[[existing.id,existing]]:[]),locks=[];
  let creates=0,transactions=0;
  const tx={$queryRaw:async(strings,...values)=>{locks.push({sql:strings.join('?'),values});return [];},portalRequest:{
    findUnique:async({where})=>rows.get(where.id)||null,
    create:async({data})=>{creates++;const row={id:data.id||'generated',revision:0,documents:[],...data};rows.set(row.id,row);return row;},
  }};
  const service=new PortalService({...tx,$transaction:async fn=>{transactions++;return fn(tx);}});
  return {service,rows,locks,counts:()=>({creates,transactions})};
}
test('v2 revenue period accepts year, month or quarter only and stays optional',()=>{
  assert.deepEqual(rules.validateDraftV2({}),{});
  for(const revenuePeriod of ['2026','2026-01','2026-12','2026-Q1','2026-Q4'])assert.equal(rules.validateDraftV2({revenuePeriod}).revenuePeriod,revenuePeriod);
  for(const revenuePeriod of ['',null,2026,'0000','0000-Q1','2026-00','2026-13','2026-Q0','2026-Q5','2026-q1','2026-1','2026-01-01',' 2026','2026\n'])assert.throws(()=>rules.validateDraftV2({revenuePeriod}),e=>e.getStatus()===400);
});
test('form configuration exposes exact preview gate and technical limits without activating policy',()=>{
  const old=[process.env.NODE_ENV,process.env.PORTAL_FOUNDATION_PREVIEW];
  try{
    for(const [env,flag,allowed]of [['test','true',true],['development','true',true],['production','true',false],['test','false',false],['','true',false]]){
      process.env.NODE_ENV=env;process.env.PORTAL_FOUNDATION_PREVIEW=flag;
      const config=rules.getFormConfig();assert.equal(config.previewEnabled,allowed);
      assert.deepEqual(config.technicalLimits,{maxFileBytes:10485760,maxActiveFiles:60});
      assert.equal(config.canSubmit,false);assert.equal(config.policyStatus,'PENDING_POLICY');
    }
  }finally{for(const [i,name]of ['NODE_ENV','PORTAL_FOUNDATION_PREVIEW'].entries())if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i];}
});
test('keyed create returns the current v2 request on retry without overwriting saved changes',preview(async()=>{
  const f=fixture();
  const first=await f.service.create('owner',{formVersion:2,clientRequestId:key,data:{revenuePeriod:'2026'}});
  assert.equal(first.id,key);assert.equal(first.data.revenuePeriod,'2026');
  Object.assign(first,{revision:4,data:{companyName:'Saved later'}});
  const retry=await f.service.create('owner',{formVersion:2,clientRequestId:key,data:{companyName:'Retry payload'}});
  assert.equal(retry.reference,first.reference);assert.equal(retry.revision,4);assert.deepEqual(retry.data,{companyName:'Saved later'});
  assert.deepEqual(f.counts(),{creates:1,transactions:2});
  assert.equal(f.locks.length,2);assert.match(f.locks[0].sql,/pg_advisory_xact_lock\(hashtext/);
  assert.equal(f.locks[0].values[0],f.locks[1].values[0]);assert.ok(f.locks[0].values[0].includes('owner'));assert.ok(f.locks[0].values[0].includes(key));
  assert.deepEqual((await f.service.create('owner',{formVersion:2,clientRequestId:key,data:{unexpected:'stale payload'}})).data,{companyName:'Saved later'});
}));
test('key collisions hide foreign ownership and reject legacy records with the same generic conflict',preview(async()=>{
  const messages=[];
  for(const existing of [{id:key,accountId:'other',formVersion:2},{id:key,accountId:'owner',formVersion:1}]){
    const f=fixture(existing);
    await assert.rejects(f.service.create('owner',{formVersion:2,clientRequestId:key,data:{}}),e=>{messages.push(e.message);return e.getStatus()===409;});
    assert.equal(f.counts().creates,0);
  }
  assert.equal(messages[0],messages[1]);
}));
test('client request key is UUIDv4, v2-only and does not relax body allowlist',preview(async()=>{
  const f=fixture();
  for(const body of [{clientRequestId:key},{formVersion:1,clientRequestId:key},{formVersion:2,clientRequestId:'bad'},{formVersion:2,clientRequestId:null},{formVersion:2,clientRequestId:key+'\n'},{formVersion:2,clientRequestId:'11111111-1111-1111-8111-111111111111'},{formVersion:2,clientRequestId:key,accountId:'other'}])await assert.rejects(f.service.create('owner',body),e=>e.getStatus()===400);
  assert.equal(f.counts().creates,0);
}));
test('unkeyed creates preserve direct legacy and preview creation',preview(async()=>{
  const f=fixture();
  assert.equal((await f.service.create('owner',{data:{companyName:'Legacy'}})).formVersion,1);
  assert.equal((await f.service.create('owner',{formVersion:2,data:{}})).formVersion,2);
  assert.deepEqual(f.counts(),{creates:2,transactions:0});
}));
test('a racing unique collision becomes a generic conflict without leaking database details',preview(async()=>{
  const service=new PortalService({$transaction:async()=>{throw new Prisma.PrismaClientKnownRequestError('private account details',{code:'P2002',clientVersion:'test'});}});
  await assert.rejects(service.create('owner',{formVersion:2,clientRequestId:key}),e=>e.getStatus()===409 && !e.message.includes('private'));
}));
test('keyed creation keeps backend failures visible rather than returning a synthetic request',preview(async()=>{
  const failure=new Error('transaction unavailable');
  const service=new PortalService({$transaction:async()=>{throw failure;}});
  await assert.rejects(service.create('owner',{formVersion:2,clientRequestId:key}),e=>e===failure);
}));
test('uppercase UUID retries address the same canonical request id',preview(async()=>{
  const f=fixture();
  const uuid='abcdefab-cdef-4abc-8abc-abcdefabcdef';
  const first=await f.service.create('owner',{formVersion:2,clientRequestId:uuid.toUpperCase()});
  const retry=await f.service.create('owner',{formVersion:2,clientRequestId:uuid});
  assert.equal(first.id,uuid);assert.equal(retry.id,first.id);assert.equal(f.counts().creates,1);
}));
