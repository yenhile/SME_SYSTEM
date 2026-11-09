const {test}=require('node:test'),assert=require('node:assert/strict');
require('reflect-metadata');
const {assertNoCoordinationConflict,assertNoCompanyConflict}=require('../dist/modules/assignments/assignment-coordination');
const {assignmentPrediction}=require('../dist/modules/assignments/assignment.transactions');
test('COI uses sender identity rather than active role; decision checks every pending COI',async()=>{
  const calls=[],tx={assignmentChangeRequest:{findFirst:async q=>{calls.push(q.where);return{id:'pending'};}}};
  await assert.rejects(assertNoCoordinationConflict(tx,{applicationId:'loan'},'sender'),e=>e.getStatus()===403);assert.equal(calls[0].requestedById,'sender');
  await assert.rejects(assertNoCoordinationConflict(tx,{applicationId:'loan'},'approver',true),e=>e.getStatus()===403);assert.equal(calls[1].requestedById,undefined);
});
test('Company conflict is checked under the actor/taxCode lock',async()=>{
  let locked=false;const tx={$queryRaw:async()=>{locked=true;return[];},assignmentChangeRequest:{findFirst:async q=>{assert.ok(locked);assert.equal(q.where.requestedById,'sender');return{id:'pending'};}}};
  await assert.rejects(assertNoCompanyConflict(tx,'sender','synthetic-tax'),e=>e.getStatus()===403);
});
test('prediction failure is reported separately and retry never calls prediction again',async()=>{
  let calls=0;const service={predictForApplication:async()=>{calls++;throw Error('synthetic dependency failure');}};
  assert.equal((await assignmentPrediction(service,'loan',false)).status,'FAILED');assert.equal((await assignmentPrediction(service,'loan',true)).status,'NOT_REPEATED');assert.equal(calls,1);
});
test('Unavailable prediction has its own outcome',async()=>{assert.equal((await assignmentPrediction({predictForApplication:async()=>({unavailable:true,message:'Synthetic PA1'})},'loan',false)).status,'UNAVAILABLE');});
