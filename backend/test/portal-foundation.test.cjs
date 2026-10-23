const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {PortalService}=require('../dist/modules/portal/portal.service');

function fixture(version=2) {
  const state={id:'request',accountId:'owner',status:'DRAFT',formVersion:version,checklistVersion:version===2?'sme-preview-v2':'legacy-v1',revision:0,data:{},documents:[]};
  const tx={ $queryRaw:async()=>[], portalRequest:{
    findFirst:async({where})=>where.accountId==='owner'?{...state}:null,
    findUnique:async()=>({...state}),
    findUniqueOrThrow:async()=>({...state}),
    update:async({data})=>Object.assign(state,data),
    create:async({data})=>data,
  }};
  return {state,service:new PortalService({...tx,$transaction:async fn=>fn(tx)})};
}
function preview(fn) {
  return async()=>{const old=[process.env.NODE_ENV,process.env.PORTAL_FOUNDATION_PREVIEW];
    process.env.NODE_ENV='test';process.env.PORTAL_FOUNDATION_PREVIEW='true';
    try {await fn();} finally {for(const [i,key] of ['NODE_ENV','PORTAL_FOUNDATION_PREVIEW'].entries()) if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];}
  };
}
test('v2 draft revision prevents lost edits and legacy body cannot erase extended data',preview(async()=>{
  const {service,state}=fixture();
  await service.update('request','owner',{data:{contactName:'New contact'},expectedRevision:0});
  assert.equal(state.revision,1);assert.equal(state.data.contactName,'New contact');
  await assert.rejects(service.update('request','owner',{data:{},expectedRevision:0}),e=>e.getStatus()===409);
  await assert.rejects(service.update('request','owner',{data:{}}),e=>e.getStatus()===400);
  assert.equal(state.data.contactName,'New contact');
}));
test('v2 cannot submit a draft while bank policy is pending',preview(async()=>{
  const {service,state}=fixture();
  await assert.rejects(service.submit('request','owner'),e=>e.getStatus()===409 && /chính sách/i.test(e.message));
  assert.equal(state.status,'DRAFT');
}));
test('legacy drafts remain editable and object ownership is checked',async()=>{
  const {service,state}=fixture(1);
  await service.update('request','owner',{data:{companyName:'Legacy'}});
  assert.equal(state.data.companyName,'Legacy');assert.equal(state.formVersion,1);
  await assert.rejects(service.update('request','other',{data:{}}),e=>e.getStatus()===404);
});
test('acceptance also fails closed for an assigned v2 request while policy is pending',async()=>{
  const {service,state}=fixture();state.status='ASSIGNED';state.assignedTo='officer';
  await assert.rejects(service.accept('request','officer'),e=>e.getStatus()===409 && /chính sách/i.test(e.message));
  assert.equal(state.status,'ASSIGNED');
});
test('preview opt-in is denied in production even when feature flag is enabled',async()=>{
  const old=[process.env.NODE_ENV,process.env.PORTAL_FOUNDATION_PREVIEW];
  process.env.NODE_ENV='production';process.env.PORTAL_FOUNDATION_PREVIEW='true';
  try {await assert.rejects(fixture().service.create('owner',{formVersion:2,data:{}}),e=>e.getStatus()===409);}
  finally {for(const [i,key] of ['NODE_ENV','PORTAL_FOUNDATION_PREVIEW'].entries()) if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];}
});
test('document history heads include withdrawn final versions but require ownership',async()=>{
  let query;
  const service=new PortalService({portalRequest:{findFirst:async({where})=>where.accountId==='owner'?{id:'request',documents:[]}:null},portalDocument:{findMany:async args=>{query=args;return[{id:'withdrawn',withdrawnAt:new Date()}];}}});
  assert.equal((await service.documentHeads('request','owner')).length,1);
  assert.deepEqual(query.where,{requestId:'request',nextVersion:{is:null}});
  assert.equal(query.select.filePath,undefined);
  await assert.rejects(service.documentHeads('request','other'),e=>e.getStatus()===404);
});
test('staff V2 download serves only frozen snapshot bytes and metadata',async()=>{
  const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
  const {createHash}=require('node:crypto');
  const {createV2Snapshot}=require('../dist/modules/portal/portal.snapshot');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'portal-download-'));
  const buffer=Buffer.from('synthetic frozen content');
  const doc={id:'doc',requestId:'request',filePath:'own.pdf',fileName:'original.pdf',documentGroup:'A',fileSize:buffer.length,mimeType:'application/pdf',version:1,coverage:[],uploadedAt:new Date(),sha256:createHash('sha256').update(buffer).digest('hex')};
  const r={id:'request',accountId:'owner',formVersion:2,revision:0,data:{},checklistVersion:'TEST-1',submittedAt:new Date()};
  r.checklistSnapshot=createV2Snapshot(r,{version:'TEST-1'},[],[doc],r.submittedAt);
  const service=new PortalService({portalDocument:{findFirst:async()=>doc}}); service.dir=dir; service.one=async()=>r;
  try {
    await fs.writeFile(path.join(dir,doc.filePath),buffer);
    assert.deepEqual((await service.download('request','doc',undefined,{id:'officer',roles:['CBTD']})).buffer,buffer);
    doc.fileName='changed.pdf';
    await assert.rejects(service.download('request','doc',undefined,{id:'officer',roles:['CBTD']}),e=>e.getStatus()===409);
    doc.fileName='original.pdf';await fs.writeFile(path.join(dir,doc.filePath),Buffer.from('mutated frozen content!'));
    await assert.rejects(service.download('request','doc',undefined,{id:'officer',roles:['CBTD']}),e=>e.getStatus()===409);
  } finally {await fs.unlink(path.join(dir,doc.filePath)).catch(()=>{});await fs.rmdir(dir);}
});
