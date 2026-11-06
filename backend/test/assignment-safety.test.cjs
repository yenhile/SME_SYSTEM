const {withCoordination}=require('./helpers/coordination-fixture.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
require('reflect-metadata');
const {AssignmentsService}=require('../dist/modules/assignments/assignments.service');

function fixture(){
  const state={loan:{id:'loan',applicationCode:'Synthetic',assignedTo:'A',assignmentVersion:0,currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',completedAt:null},history:[],locks:[],predictions:0};
  const tx={$queryRaw:async(strings,...values)=>{state.locks.push(strings.join('?'));return[];},
    loanApplication:{findUnique:async()=>structuredClone(state.loan),update:async({data})=>{for(const[k,v]of Object.entries(data))state.loan[k]=v&&typeof v==='object'&&'increment'in v?(state.loan[k]??0)+v.increment:v;return structuredClone(state.loan);}},
    user:{findUnique:async({where})=>({id:where.id,fullName:'Synthetic',isActive:true,roles:[{role:{code:'CBTD'}}]})},
    applicationAssignment:{findUnique:async({where})=>state.history.find(r=>r.clientRequestId===where.applicationId_clientRequestId.clientRequestId)||null,create:async({data})=>{const r={id:randomUUID(),...data};state.history.push(r);return structuredClone(r);}}};
  return{state,tx,service:new AssignmentsService(withCoordination({$transaction:fn=>fn(tx)}),{predictForApplication:async()=>{state.predictions++;}})};
}
const body=(version=0,newOfficerId='B')=>({newOfficerId,reason:'  Synthetic workload balancing  ',expectedAssignmentVersion:version,clientRequestId:randomUUID()});

test('stale and ABA screens cannot overwrite the current assignment',async()=>{
  const f=fixture();await f.service.reassign('loan',body(),'manager');
  await assert.rejects(f.service.reassign('loan',body(0,'C'),'manager'),e=>e.getStatus?.()===409);
  await f.service.reassign('loan',body(1,'A'),'manager');assert.equal(f.state.loan.assignedTo,'A');
  await assert.rejects(f.service.reassign('loan',body(0,'C'),'manager'),e=>e.getStatus?.()===409);
  assert.equal(f.state.history.length,2);assert.equal(f.state.loan.assignmentVersion,2);
});
test('retry replays its receipt without history, owner changes or prediction side effects',async()=>{
  const f=fixture(),operation=body();await f.service.reassign('loan',operation,'manager');
  await f.service.reassign('loan',body(1,'C'),'manager');
  const replay=await f.service.reassign('loan',operation,'manager');
  assert.equal(replay.replayed,true);assert.equal(replay.assignment.toUserId,'B');assert.equal(replay.loan.assignedTo,'C');
  assert.equal(f.state.history.length,2);assert.equal(f.state.predictions,2);
  await assert.rejects(f.service.reassign('loan',{...operation,newOfficerId:'D'},'manager'),e=>e.getStatus?.()===409);
  await assert.rejects(f.service.reassign('loan',operation,'different-manager'),e=>e.getStatus?.()===409);
});
test('reason is required, trimmed and bounded; missing version or operation ID cannot bypass safety',async()=>{
  const f=fixture();for(const changes of [{reason:undefined},{reason:'   '},{reason:'x'.repeat(2001)},{expectedAssignmentVersion:undefined},{expectedAssignmentVersion:-1},{clientRequestId:undefined},{clientRequestId:'bad'}])await assert.rejects(f.service.reassign('loan',{...body(),...changes},'manager'),e=>e.getStatus?.()===400);
  await f.service.reassign('loan',body(),'manager');assert.equal(f.state.history[0].reason,'Synthetic workload balancing');
});
test('recipient is read after the shared officer lock; disabled recipients do not receive a loan',async()=>{
  const f=fixture();f.tx.user.findUnique=async()=>{assert.ok(f.state.locks.some(s=>s.includes('pg_advisory_xact_lock')),'Recipient must be locked before validation');return{id:'B',isActive:false,roles:[]};};
  await assert.rejects(f.service.reassign('loan',body(),'manager'),e=>e.getStatus?.()===404);
  assert.equal(f.state.history.length,0);assert.equal(f.state.loan.assignedTo,'A');
});
