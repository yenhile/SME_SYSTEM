const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {LoanApplicationsController}=require('../dist/modules/loan-applications/loan-applications.controller');
const {PortalIntakesController}=require('../dist/modules/portal/portal.controller');
const {parseScanHours}=require('../dist/modules/prediction/prediction-scheduler.service');

test('a loan created at the counter is scored straight away and an ML failure does not fail the creation',async()=>{
  const calls=[];
  const ok=new LoanApplicationsController({create:async()=>({id:'loan-9'})},{predictForApplication:async id=>{calls.push(id);}});
  assert.equal((await ok.create({},'cbtd')).id,'loan-9');assert.deepEqual(calls,['loan-9']);
  const down=new LoanApplicationsController({create:async()=>({id:'loan-9'})},{predictForApplication:async()=>{throw new Error('ML tắt');}});
  assert.equal((await down.create({},'cbtd')).id,'loan-9');
});
test('pressing Accept twice scores only once',async()=>{
  const calls=[];
  const prediction={predictForApplication:async id=>{calls.push(id);}};
  const first=new PortalIntakesController({accept:async()=>({loanId:'L',request:{}})},prediction);
  const again=new PortalIntakesController({accept:async()=>({loanId:'L',replayed:true,request:{}})},prediction);
  await first.accept({user:{id:'u'}},'r',{});await again.accept({user:{id:'u'}},'r',{});
  assert.deepEqual(calls,['L']);
});
test('scan hours default to 08:00 and 13:00, accept a custom list and ignore garbage',()=>{
  assert.deepEqual(parseScanHours(undefined),[8,13]);
  assert.deepEqual(parseScanHours('13, 8,8'),[8,13]);
  assert.deepEqual(parseScanHours('9'),[9]);
  assert.deepEqual(parseScanHours('25,abc'),[8,13]);
});
