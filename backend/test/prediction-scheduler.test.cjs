const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {PredictionSchedulerService}=require('../dist/modules/prediction/prediction-scheduler.service');

const vn=(date,time)=>new Date(`${date}T${time}:00+07:00`);
const ACTIVATION={policyCode:'PA1',calendarVersion:'VN-20260101-20261231-v1'};
function build({activation=ACTIVATION,loans=[],predict=async()=>({id:'p'})}={}){
  const calls=[];
  const prisma={slaPolicyActivation:{findFirst:async()=>activation},loanApplication:{findMany:async()=>loans}};
  const prediction={predictForApplication:async(id)=>{calls.push(id);return predict(id);}};
  return {service:new PredictionSchedulerService(prisma,prediction),calls};
}
const loan=(id,lastAt)=>({id,delayPredictions:lastAt?[{predictionTimestamp:lastAt}]:[]});

test('weekend is skipped: no prediction rows are added when the SLA clock did not move',async()=>{
  const {service,calls}=build({loans:[loan('a')]});
  const r=await service.scanOnce(vn('2026-11-08','08:00'));   // Chủ nhật
  assert.equal(r.skipped,'không phải ngày làm việc');assert.equal(calls.length,0);
});
test('a public holiday in the calendar is skipped too',async()=>{
  const {service}=build();
  assert.equal((await service.scanOnce(vn('2026-09-02','08:00'))).skipped,'không phải ngày làm việc');
});
test('nothing is scored while PA1 is not active',async()=>{
  const {service,calls}=build({activation:null,loans:[loan('a')]});
  assert.equal((await service.scanOnce(vn('2026-11-09','08:00'))).skipped,'PA1 chưa được kích hoạt');assert.equal(calls.length,0);
});
test('a working day scores every open loan and counts unavailable ones separately',async()=>{
  const {service,calls}=build({loans:[loan('a'),loan('b'),loan('c')],predict:async(id)=>id==='b'?{unavailable:true}:{id}});
  const r=await service.scanOnce(vn('2026-11-09','08:00'));
  assert.deepEqual(calls,['a','b','c']);assert.equal(r.predicted,2);assert.equal(r.unavailable,1);assert.equal(r.failed,0);
});
test('catch-up scan only scores loans without a recent prediction',async()=>{
  const now=vn('2026-11-09','09:00');
  const {service,calls}=build({loans:[loan('fresh',new Date(now.getTime()-2*3600000)),loan('old',new Date(now.getTime()-9*3600000)),loan('never')]});
  await service.scanOnce(now,6);
  assert.deepEqual(calls,['old','never']);
});
test('the scan stops early when the ML service keeps failing, without throwing',async()=>{
  const {service,calls}=build({loans:[loan('1'),loan('2'),loan('3'),loan('4'),loan('5')],predict:async()=>{throw new Error('ML down');}});
  const r=await service.scanOnce(vn('2026-11-09','08:00'));
  assert.equal(r.aborted,true);assert.equal(r.failed,3);assert.equal(calls.length,3);
});
test('one failure in the middle does not stop the rest',async()=>{
  const {service,calls}=build({loans:[loan('1'),loan('2'),loan('3')],predict:async(id)=>{if(id==='2')throw new Error('x');return{id};}});
  const r=await service.scanOnce(vn('2026-11-09','08:00'));
  assert.equal(calls.length,3);assert.equal(r.failed,1);assert.equal(r.predicted,2);assert.equal(r.aborted,false);
});
