const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {predictionStatusOf,firstStagePolicies}=require('../dist/modules/prediction/prediction-status');
const {PredictionService}=require('../dist/modules/prediction/prediction.service');
const {DashboardService}=require('../dist/modules/dashboard/dashboard.service');
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');
const {SIMULATED_CALENDAR_V1}=require('../dist/modules/workflow/sla/working-time');

const vn=(date,time)=>new Date(`${date}T${time}:00+07:00`);

test('predictionStatusOf: PA1 first stage overrides everything; otherwise depends on a stored prediction',()=>{
  assert.equal(predictionStatusOf(false,'PA1'),'INCOMPATIBLE_PA1');
  assert.equal(predictionStatusOf(true,'PA1'),'INCOMPATIBLE_PA1');
  assert.equal(predictionStatusOf(true,null),'AVAILABLE');
  assert.equal(predictionStatusOf(false,null),'NONE');
  assert.equal(predictionStatusOf(false,undefined),'NONE');
});
test('firstStagePolicies keeps the earliest Reception row per loan and handles an empty list',async()=>{
  let calls=0;
  const db={applicationStageHistory:{findMany:async()=>{calls++;return[{applicationId:'a',slaPolicy:'PA1'},{applicationId:'a',slaPolicy:null},{applicationId:'b',slaPolicy:null}];}}};
  const map=await firstStagePolicies(db,['a','b']);
  assert.equal(map.get('a'),'PA1');assert.equal(map.get('b'),null);
  assert.equal((await firstStagePolicies(db,[])).size,0);assert.equal(calls,1);
});

// C.9.2: không gọi ML và không tạo xác suất giả khi đặc trưng thời gian tiếp nhận lấy từ công đoạn PA1.
function predictor(firstPolicy) {
  const state={fetches:0,created:0};
  const loan={id:'l1',applicationCode:'HS-1',assignedTo:'u',loanTermMonths:12,loanType:'VAY_VON_LUU_DONG',proposedAmount:1e9,officialAmount:null,supplementCount:0,
    company:{industry:'Sản xuất',establishedYear:2020,annualRevenue:5e9,charterCapital:1e9},
    // stageHistories sắp xếp giảm dần theo thời điểm vào: phần tử cuối là công đoạn Tiếp nhận.
    stageHistories:[{enteredAt:new Date(),netWorkDurationHours:null,slaPolicy:'PA1'},{enteredAt:new Date(Date.now()-3600000),netWorkDurationHours:2,slaPolicy:firstPolicy}]};
  const prisma={loanApplication:{findUnique:async()=>loan,count:async()=>3},delayPrediction:{create:async({data})=>{state.created++;return{id:'p1',...data};}}};
  const service=new PredictionService(prisma);
  return {state,service};
}
test('ML is skipped for a loan whose Reception stage uses PA1',async()=>{
  const {state,service}=predictor('PA1');
  const original=global.fetch;global.fetch=async()=>{state.fetches++;throw new Error('ML must not be called');};
  try {
    const result=await service.predictForApplication('l1');
    assert.equal(result.unavailable,true);assert.equal(result.reason,'PA1_INCOMPATIBLE');assert.match(result.message,/tương thích PA1/);
  } finally {global.fetch=original;}
  assert.equal(state.fetches,0);assert.equal(state.created,0);
});
test('ML is still called when the Reception stage kept the legacy calculation, even if later stages use PA1',async()=>{
  const {state,service}=predictor(null);
  const original=global.fetch;
  global.fetch=async(url,init)=>{state.fetches++;state.payload=JSON.parse(init.body);return{ok:true,json:async()=>({delay_probability:0.4,risk_level:'TRUNG BÌNH',top_reasons:['x'],model_version:'v1.0-rf'})};};
  try {await service.predictForApplication('l1');} finally {global.fetch=original;}
  assert.equal(state.fetches,1);assert.equal(state.created,1);
  assert.equal(state.payload.previous_stage_duration_hours,2);
});

// Dashboard: không bịa xác suất; phân biệt "chưa có" với "chưa có dự báo tương thích PA1".
function dashboard(rows,policies) {
  const prisma={
    loanApplication:{findMany:async()=>rows},
    applicationStageHistory:{findMany:async()=>policies},
  };
  return new DashboardService(prisma);
}
const warnRow=(id,over={})=>({id,applicationCode:`HS-${id}`,company:{companyName:'ABC',industry:'x'},officialAmount:null,proposedAmount:1e9,currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',
  supplementCount:0,assignedUser:null,assignedTo:null,delayPredictions:[],...over});
test('early warnings never invent a risk level or probability when there is no prediction',async()=>{
  const service=dashboard([
    warnRow('none'),
    warnRow('pa1'),
    warnRow('real',{delayPredictions:[{riskLevel:'CAO',delayProbability:0.9,predictionTimestamp:new Date(),topReasonsJson:'[]'}]}),
  ],[{applicationId:'pa1',slaPolicy:'PA1'},{applicationId:'none',slaPolicy:null},{applicationId:'real',slaPolicy:null}]);
  const list=await service.getEarlyWarningList();
  assert.deepEqual(list.map(x=>x.id),['real','none','pa1'].sort((a,b)=>a==='real'?-1:b==='real'?1:0),'real prediction first; predictionless rows keep a stable order after it');
  const byId=Object.fromEntries(list.map(x=>[x.id,x]));
  assert.equal(byId.real.riskLevel,'CAO');assert.equal(byId.real.predictionStatus,'AVAILABLE');
  assert.equal(byId.none.riskLevel,null);assert.equal(byId.none.delayProbability,null);assert.equal(byId.none.predictionStatus,'NONE');
  assert.equal(byId.pa1.riskLevel,null);assert.equal(byId.pa1.delayProbability,null);assert.equal(byId.pa1.predictionStatus,'INCOMPATIBLE_PA1');
});

// Chi tiết hồ sơ: trạng thái SLA và số giờ đang chạy của công đoạn PA1 mở.
function loanService({loan,pauses=[]}) {
  const prisma={loanApplication:{findUnique:async()=>loan},applicationStagePause:{findMany:async()=>pauses}};
  return new LoanApplicationsService(prisma);
}
const stageRow=(over={})=>({id:'h1',exitedAt:null,enteredAt:vn('2026-10-27','09:00'),pausedAt:null,pausedDurationHours:0,slaStandardHours:4,slaPolicy:'PA1',slaCalendarVersion:SIMULATED_CALENDAR_V1.version,...over});
const loanRow=(over={})=>({id:'l1',currentStatus:'RECEIVED',delayPredictions:[],stageHistories:[stageRow()],...over});
test('open PA1 stage reports live working hours at the viewing time and no waiting party',async()=>{
  const view=await loanService({loan:loanRow()}).findOne('l1',vn('2026-10-27','14:00'));
  assert.equal(view.slaState.policy,'PA1');assert.equal(view.slaState.waiting,null);assert.equal(view.slaState.slaRunning,true);
  assert.equal(view.liveSla.actualDurationHours,4);assert.equal(view.liveSla.netWorkDurationHours,4);assert.equal(view.predictionStatus,'INCOMPATIBLE_PA1');
});
test('PA1 stage with an open pause waits for the enterprise and the live net hours exclude it',async()=>{
  const view=await loanService({loan:loanRow({currentStatus:'SUPPLEMENT_REQUIRED'}),pauses:[{startedAt:vn('2026-10-27','10:00'),endedAt:null}]}).findOne('l1',vn('2026-10-27','15:00'));
  assert.equal(view.slaState.waiting,'ENTERPRISE');assert.equal(view.slaState.slaRunning,false);
  assert.equal(view.liveSla.actualDurationHours,5);assert.equal(view.liveSla.pausedDurationHours,4);assert.equal(view.liveSla.netWorkDurationHours,1);
});
test('PA1 stage with the supplement fully answered shows the bank checking and the SLA running',async()=>{
  const view=await loanService({loan:loanRow({currentStatus:'SUPPLEMENT_REQUIRED'}),pauses:[{startedAt:vn('2026-10-27','10:00'),endedAt:vn('2026-10-27','14:00')}]}).findOne('l1',vn('2026-10-27','15:00'));
  assert.equal(view.slaState.waiting,'BANK');assert.equal(view.slaState.slaRunning,true);
});
test('legacy stage keeps the old behaviour: waits for the enterprise, no live PA1 hours, and calculation stays 24/7',async()=>{
  const legacy=stageRow({slaPolicy:null,slaCalendarVersion:null,pausedAt:vn('2026-10-27','10:00')});
  const view=await loanService({loan:loanRow({currentStatus:'SUPPLEMENT_REQUIRED',stageHistories:[legacy]})}).findOne('l1',vn('2026-10-27','15:00'));
  assert.equal(view.slaState.policy,null);assert.equal(view.slaState.waiting,'ENTERPRISE');assert.equal(view.slaState.slaRunning,false);
  assert.equal(view.liveSla,null);assert.equal(view.predictionStatus,'NONE');
});
test('viewing outside the calendar coverage reports the problem instead of a made-up number',async()=>{
  const view=await loanService({loan:loanRow()}).findOne('l1',vn('2026-11-10','10:00'));
  assert.match(view.liveSla.error,/không bao phủ/);assert.equal(view.liveSla.actualDurationHours,undefined);
});
