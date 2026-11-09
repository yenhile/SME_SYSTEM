const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {LoanApplicationsController}=require('../dist/modules/loan-applications/loan-applications.controller');
const {PortalIntakesController}=require('../dist/modules/portal/portal.controller');
const {parseScanHours}=require('../dist/modules/prediction/prediction-scheduler.service');

test('a loan created at the counter is scored straight away and an ML failure does not fail the creation',async()=>{
  const calls=[];
  const ok=new LoanApplicationsController({create:async()=>({message:'ok',loan:{id:'loan-9'}})},{predictForApplication:async id=>{calls.push(id);}});   // đúng dạng LoanApplicationsService.create trả về
  assert.equal((await ok.create({},'cbtd')).loan.id,'loan-9');assert.deepEqual(calls,['loan-9']);
  const down=new LoanApplicationsController({create:async()=>({message:'ok',loan:{id:'loan-9'}})},{predictForApplication:async()=>{throw new Error('ML tắt');}});
  assert.equal((await down.create({},'cbtd')).loan.id,'loan-9');
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

test('the next scan is the nearest of 08:00 and 13:00 Vietnam time',()=>{
  const {nextScanAt}=require('../dist/modules/prediction/prediction-scheduler.service');
  const vn=(iso)=>new Date(iso+'+07:00');
  const at=(now)=>nextScanAt(vn(now),[8,13]).toISOString();
  assert.equal(at('2026-11-09T07:59:00'),vn('2026-11-09T08:00:00').toISOString(),'just before 08:00');
  assert.equal(at('2026-11-09T08:00:00'),vn('2026-11-09T13:00:00').toISOString(),'exactly 08:00 moves on to 13:00');
  assert.equal(at('2026-11-09T12:00:00'),vn('2026-11-09T13:00:00').toISOString(),'noon -> 13:00 the same day');
  assert.equal(at('2026-11-09T13:00:00'),vn('2026-11-10T08:00:00').toISOString(),'exactly 13:00 moves to 08:00 next day');
  assert.equal(at('2026-11-09T22:00:00'),vn('2026-11-10T08:00:00').toISOString(),'evening -> 08:00 next day');
  assert.equal(nextScanAt(vn('2026-11-09T12:00:00'),[8]).toISOString(),vn('2026-11-10T08:00:00').toISOString(),'a single hour behaves as before');
});
