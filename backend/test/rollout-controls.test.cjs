const {withCoordination}=require('./helpers/coordination-fixture.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {DocumentsService}=require('../dist/modules/documents/documents.service');
const {PortalService}=require('../dist/modules/portal/portal.service');
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');

test('document writes recheck completion after acquiring the loan lock',async()=>{
  let writes=0;
  const tx={$queryRaw:async()=>[],loanApplication:{findUnique:async()=>({id:'l',assignedTo:'u',currentStage:'HOAN_TAT',completedAt:new Date()})},document:{create:async()=>{writes++;return{};}}};
  const service=new DocumentsService(withCoordination({$transaction:async f=>f(tx)}));
  await assert.rejects(service.create('l',{documentType:'PHAP_LY',fileName:'x',filePath:'x',fileSize:1,mimeType:'application/pdf'},'u','CBTD'),e=>e.getStatus()===403);
  assert.equal(writes,0);
});
test('document writes recheck assignment after acquiring the loan lock',async()=>{
  const tx={$queryRaw:async()=>[],loanApplication:{findUnique:async()=>({id:'l',assignedTo:'new',currentStage:'TIEP_NHAN',completedAt:null})},document:{create:async()=>{throw Error('write must not happen');}}};
  await assert.rejects(new DocumentsService(withCoordination({$transaction:async f=>f(tx)})).create('l',{},'old','CBTD'),e=>e.getStatus()===403);
});
test('Portal assignment refuses a manager assigning themselves before any mutation',async()=>{
  const service=new PortalService(withCoordination({$transaction:async()=>{throw Error('must reject before mutation');}}));
  await assert.rejects(service.assign('r',{officerId:'m',expectedAssignedTo:null},'m'),e=>e.getStatus()===400);
});
test('document confirmation cannot use the pre-reassignment guard result',async()=>{
  let writes=0;
  const tx={$queryRaw:async()=>[],loanApplication:{findUnique:async()=>({id:'l',assignedTo:'new',currentStage:'TIEP_NHAN',currentStatus:'RECEIVED'}),update:async()=>{writes++;return{};}}};
  await assert.rejects(new LoanApplicationsService(withCoordination({$transaction:async f=>f(tx)})).checkDocuments('l',true,{id:'old',activeRole:'CBTD'}),e=>e.getStatus()===403);
  assert.equal(writes,0);
});
test('setting amount rechecks completion and current assignment inside transaction',async()=>{
  const tx={$queryRaw:async()=>[],loanApplication:{findUnique:async()=>({id:'l',assignedTo:'new',currentStage:'TIEP_NHAN',completedAt:new Date()}),update:async()=>({})}};
  await assert.rejects(new LoanApplicationsService(withCoordination({$transaction:async f=>f(tx)})).setOfficialAmount('l',10000000,{id:'old',activeRole:'CBTD'}),e=>e.getStatus()===403);
});
