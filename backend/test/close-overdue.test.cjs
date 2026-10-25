const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {Reflector}=require('@nestjs/core');
const {RolesGuard}=require('../dist/common/guards/roles.guard');
const {WorkflowService}=require('../dist/modules/workflow/workflow.service');
const {WorkflowController}=require('../dist/modules/workflow/workflow.controller');

const NOW=new Date('2026-11-12T03:00:00Z');
const manager={id:'manager',activeRole:'QUAN_LY'};
function fixture({loan={},supplements,history}={}) {
  const state={loan:{id:'loan1',currentStage:'TIEP_NHAN',currentStatus:'SUPPLEMENT_REQUIRED',completedAt:null,...loan},
    supplements:supplements??[{id:'s1',status:'PENDING',requestedAt:new Date('2026-10-28T03:00:00Z'),deadlineAt:null}],
    history:history??{id:'h1',enteredAt:new Date('2026-10-27T03:00:00Z'),pausedAt:new Date('2026-10-27T05:00:00Z'),pausedDurationHours:1,slaStandardHours:4},
    loanUpdates:[],supplementUpdates:[],historyUpdates:[],historyCreates:[],locks:0,predicted:0};
  const tx={
    $queryRaw:async()=>{state.locks++;return[];},
    loanApplication:{findUnique:async()=>state.loan,update:async({data})=>{state.loanUpdates.push(data);return{...state.loan,...data};}},
    supplementRequest:{findMany:async()=>state.supplements,updateMany:async({where,data})=>{state.supplementUpdates.push({where,data});return{count:1};}},
    workflowStage:{findUnique:async()=>({id:'stage-done',standardSlaHours:8})},
    applicationStageHistory:{findFirst:async()=>state.history,update:async({data})=>{state.historyUpdates.push(data);},create:async({data})=>{state.historyCreates.push(data);}},
  };
  const prisma={$transaction:async fn=>fn(tx)};
  const prediction={predictForApplication:async()=>{state.predicted++;}};
  const service=new WorkflowService(prisma,prediction);
  return {state,close:(dto,user=manager)=>service.closeOverdueSupplement('loan1',dto,user,NOW)};
}
const rejects=async(promise,status)=>assert.rejects(promise,e=>e.getStatus()===status);

test('manager closes an overdue loan: status, completion time, reason and handler are recorded',async()=>{
  const {state,close}=fixture();
  await close({reason:'  Doanh nghiệp không phản hồi  '});
  assert.equal(state.locks,1);
  const update=state.loanUpdates[0];
  assert.equal(update.currentStage,'HOAN_TAT');assert.equal(update.currentStatus,'CLOSED_TIMEOUT');
  assert.equal(update.completedAt.getTime(),NOW.getTime());
  assert.equal(update.rejectionNote,'Doanh nghiệp không phản hồi');
  assert.equal(update.rejectionReasonCode,'TC05'); // Quá hạn thời gian bổ sung chứng từ
  assert.equal(state.historyCreates.length,1);
  assert.equal(state.historyCreates[0].handledBy,'manager');
  assert.equal(state.historyCreates[0].enteredAt.getTime(),NOW.getTime());
  assert.match(state.historyCreates[0].notes,/quá hạn bổ sung/i);assert.match(state.historyCreates[0].notes,/Doanh nghiệp không phản hồi/);
  assert.equal(state.historyUpdates[0].handledBy,'manager');
  assert.equal(state.predicted,0);
});
test('pending supplements are expired, not resolved',async()=>{
  const {state,close}=fixture();
  await close({reason:'Quá hạn'});
  assert.equal(state.supplementUpdates.length,1);
  assert.equal(state.supplementUpdates[0].where.status,'PENDING');
  assert.equal(state.supplementUpdates[0].data.status,'EXPIRED');
  assert.equal(state.supplementUpdates[0].data.resolvedAt,undefined);
});
test('the paused SLA clock is finalised so the closed stage is not wrongly marked delayed',async()=>{
  const {state,close}=fixture();
  await close({reason:'Quá hạn'});
  const update=state.historyUpdates[0];
  assert.equal(update.exitedAt.getTime(),NOW.getTime());
  const pausedHours=(NOW.getTime()-new Date('2026-10-27T05:00:00Z').getTime())/3600000;
  assert.ok(Math.abs(update.pausedDurationHours-(1+pausedHours))<0.01);
  assert.equal(update.pausedAt,null);
  const actual=(NOW.getTime()-new Date('2026-10-27T03:00:00Z').getTime())/3600000;
  assert.ok(Math.abs(update.actualDurationHours-actual)<0.01);
  assert.ok(Math.abs(update.netWorkDurationHours-(actual-1-pausedHours))<0.01);
  assert.equal(update.isDelayed,false);
});
test('a blank reason is refused and nothing is written',async()=>{
  for(const reason of [undefined,'','   ']) {
    const {state,close}=fixture();
    await rejects(close({reason}),400);
    assert.equal(state.loanUpdates.length+state.supplementUpdates.length+state.historyCreates.length,0);
  }
});
test('a loan that is not yet overdue cannot be closed',async()=>{
  let f=fixture({supplements:[{id:'s1',status:'PENDING',requestedAt:new Date('2026-11-09T03:00:00Z'),deadlineAt:null}]});
  await rejects(f.close({reason:'x'}),400);
  f=fixture({supplements:[{id:'s1',status:'PENDING',requestedAt:new Date('2026-10-01T03:00:00Z'),deadlineAt:new Date('2026-11-20T03:00:00Z')}]});
  await rejects(f.close({reason:'x'}),400);
  assert.equal(f.state.loanUpdates.length,0);
});
test('an explicit deadline in the past makes the loan closable',async()=>{
  const {state,close}=fixture({supplements:[{id:'s1',status:'PENDING',requestedAt:new Date('2026-11-10T03:00:00Z'),deadlineAt:new Date('2026-11-11T03:00:00Z')}]});
  await close({reason:'x'});
  assert.equal(state.loanUpdates.length,1);
});
test('only loans waiting for supplement and not finished can be closed',async()=>{
  for(const loan of [{currentStatus:'RECEIVED'},{currentStatus:'PENDING_APPRAISAL',currentStage:'THAM_DINH'},{completedAt:new Date(),currentStage:'HOAN_TAT',currentStatus:'CLOSED_TIMEOUT'}]) {
    const {state,close}=fixture({loan});
    await rejects(close({reason:'x'}),400);
    assert.equal(state.loanUpdates.length,0);
  }
  const none=fixture({supplements:[]});
  await rejects(none.close({reason:'x'}),400);
});
test('only the QUAN_LY role may close, and a missing loan is 404',async()=>{
  for(const activeRole of ['CBTD','THAM_QUYEN','ADMIN']) {
    const {state,close}=fixture();
    await rejects(close({reason:'x'},{id:'u',activeRole}),403);
    assert.equal(state.loanUpdates.length,0);
  }
  const prisma={$transaction:async fn=>fn({$queryRaw:async()=>[],loanApplication:{findUnique:async()=>null}})};
  await rejects(new WorkflowService(prisma,{}).closeOverdueSupplement('x',{reason:'r'},manager,NOW),404);
});
test('close endpoint is limited to QUAN_LY while transition stays with CBTD and THAM_QUYEN',()=>{
  const guard=new RolesGuard(new Reflector());
  const ctx=(method,roles)=>({getHandler:()=>WorkflowController.prototype[method],getClass:()=>WorkflowController,switchToHttp:()=>({getRequest:()=>({user:{roles}})})});
  assert.equal(guard.canActivate(ctx('closeOverdueSupplement',['QUAN_LY'])),true);
  for(const role of ['CBTD','THAM_QUYEN','ADMIN']) assert.throws(()=>guard.canActivate(ctx('closeOverdueSupplement',[role])),e=>e.getStatus()===403);
  assert.throws(()=>guard.canActivate(ctx('transitionStage',['QUAN_LY'])),e=>e.getStatus()===403);
  assert.equal(guard.canActivate(ctx('transitionStage',['CBTD'])),true);
});
test('a closed loan can no longer be moved through the workflow',async()=>{
  const tx={$queryRaw:async()=>[],loanApplication:{findUnique:async()=>({id:'loan1',currentStage:'HOAN_TAT',currentStatus:'CLOSED_TIMEOUT',completedAt:new Date()})}};
  const service=new WorkflowService({$transaction:async fn=>fn(tx)},{});
  await rejects(service.transitionStage('loan1',{targetStage:'THAM_DINH',targetStatus:'PENDING_APPRAISAL'},{id:'cbtd',activeRole:'CBTD'}),400);
});
