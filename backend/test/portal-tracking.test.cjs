const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {PortalService}=require('../dist/modules/portal/portal.service');
const {PortalRequestsController}=require('../dist/modules/portal/portal.controller');
const {buildTracking}=require('../dist/modules/portal/portal.tracking');

const hist=(...codes)=>codes.map(stageCode=>({stage:{stageCode}}));
const loan=(over={})=>({currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',completedAt:null,rejectionReasonCode:null,stageHistories:hist('TIEP_NHAN'),...over});
const req=(status,over={})=>({id:'r1',reference:'DN-1',status,submittedAt:new Date('2026-10-20T03:00:00Z'),acceptedAt:null,...over});
const states=t=>t.steps.map(s=>s.state).join(',');

test('steps follow the public milestones Tiếp nhận, Thẩm định, Phê duyệt, Hoàn tất',()=>{
  const t=buildTracking(req('ACCEPTED'),loan());
  assert.deepEqual(t.steps.map(s=>s.label),['Tiếp nhận','Thẩm định','Phê duyệt','Hoàn tất']);
});
test('before acceptance the enterprise sees only submitted or assigned, with no officer details',()=>{
  let t=buildTracking(req('DRAFT'),null);
  assert.equal(t.status.code,'DRAFT');assert.equal(states(t),'pending,pending,pending,pending');
  t=buildTracking(req('SUBMITTED'),null);
  assert.equal(t.status.code,'SUBMITTED');assert.equal(states(t),'current,pending,pending,pending');
  t=buildTracking(req('ASSIGNED',{assignedTo:'secret-officer-id'}),null);
  assert.equal(t.status.code,'ASSIGNED');assert.equal(states(t),'current,pending,pending,pending');
  assert.ok(!JSON.stringify(t).includes('secret-officer-id'));
});
test('accepted loans map internal statuses to public statuses and step progress',()=>{
  const cases=[
    [loan({currentStatus:'RECEIVED'}),'RECEIVED','current,pending,pending,pending'],
    [loan({currentStatus:'CHECKED'}),'RECEIVED','current,pending,pending,pending'],
    [loan({currentStatus:'SUPPLEMENT_REQUIRED'}),'SUPPLEMENT_REQUIRED','current,pending,pending,pending'],
    [loan({currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',stageHistories:hist('TIEP_NHAN','THAM_DINH')}),'APPRAISAL','done,current,pending,pending'],
    [loan({currentStage:'THAM_DINH',currentStatus:'SUPPLEMENT_REQUIRED',stageHistories:hist('TIEP_NHAN','THAM_DINH')}),'SUPPLEMENT_REQUIRED','done,current,pending,pending'],
    [loan({currentStage:'CAP_TREN',currentStatus:'WAITING_HEAD_OFFICE',stageHistories:hist('TIEP_NHAN','THAM_DINH','CAP_TREN')}),'HEAD_OFFICE','done,done,current,pending'],
    [loan({currentStage:'HOAN_TAT',currentStatus:'APPROVED',completedAt:new Date(),stageHistories:hist('TIEP_NHAN','THAM_DINH','HOAN_TAT')}),'APPROVED','done,done,done,done'],
  ];
  for(const [l,code,steps] of cases) {
    const t=buildTracking(req('ACCEPTED'),l);
    assert.equal(t.status.code,code,JSON.stringify(l));assert.equal(states(t),steps,code);
    assert.ok(t.status.label&&t.status.message);
  }
});
test('a rejected loan shows only the general reason from the catalogue, never the internal note',()=>{
  const l=loan({currentStage:'HOAN_TAT',currentStatus:'REJECTED',completedAt:new Date(),rejectionReasonCode:'TC02',rejectionNote:'SECRET-APPRAISER-NOTE',stageHistories:hist('TIEP_NHAN','THAM_DINH','HOAN_TAT')});
  const t=buildTracking(req('ACCEPTED'),l);
  assert.equal(t.status.code,'REJECTED');
  assert.deepEqual(t.rejection,{code:'TC02',label:'Năng lực tài chính không đảm bảo'});
  assert.equal(states(t),'done,done,pending,stopped');
  assert.ok(!JSON.stringify(t).includes('SECRET'));
  const unknown=buildTracking(req('ACCEPTED'),loan({currentStage:'HOAN_TAT',currentStatus:'REJECTED',completedAt:new Date(),rejectionReasonCode:'ZZ9',stageHistories:hist('TIEP_NHAN','HOAN_TAT')}));
  assert.deepEqual(unknown.rejection,{code:null,label:'Hồ sơ không được chấp thuận'});
});
test('a loan closed for overdue supplement shows a general message without the manager reason',()=>{
  const l=loan({currentStage:'HOAN_TAT',currentStatus:'CLOSED_TIMEOUT',completedAt:new Date(),rejectionReasonCode:'TC05',rejectionNote:'SECRET-MANAGER-REASON',stageHistories:hist('TIEP_NHAN','HOAN_TAT')});
  const t=buildTracking(req('ACCEPTED'),l);
  assert.equal(t.status.code,'CLOSED');assert.equal(t.rejection,undefined);
  assert.equal(states(t),'done,pending,pending,stopped');
  assert.match(t.status.message,/quá hạn bổ sung/i);
  assert.ok(!JSON.stringify(t).includes('SECRET'));
});
test('tracking reads only the enterprise own request and selects no internal fields',async()=>{
  let query;
  const leaky=req('ACCEPTED',{loan:loan({rejectionNote:'SECRET-NOTE',assignedTo:'officer',delayPredictions:[{delayProbability:0.9}]}),assignedTo:'officer',data:{companyName:'ABC'}});
  const service=new PortalService({portalRequest:{findFirst:async q=>{query=q;return q.where.accountId==='owner'?leaky:null;}}});
  const result=await service.tracking('r1','owner');
  assert.deepEqual(query.where,{id:'r1',accountId:'owner'});
  const selected=JSON.stringify(query.select);
  for(const forbidden of ['rejectionNote','assignedTo','assignedUser','delayPredictions','notes','data','officialAmount','approvedAmount','documents']) assert.ok(!selected.includes(`"${forbidden}"`),forbidden);
  assert.ok(!JSON.stringify(result).includes('SECRET')&&!JSON.stringify(result).includes('0.9')&&!JSON.stringify(result).includes('officer'));
  await assert.rejects(service.tracking('r1','someone-else'),e=>e.getStatus()===404);
});
test('the status endpoint passes the signed-in portal account to the service',async()=>{
  let args;
  const controller=new PortalRequestsController({tracking:async(...a)=>{args=a;return 'ok';}});
  assert.equal(await controller.status({portalAccount:{id:'acc'}},'r1'),'ok');
  assert.deepEqual(args,['r1','acc']);
});
