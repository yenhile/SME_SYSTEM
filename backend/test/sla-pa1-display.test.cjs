const {withCoordination}=require('./helpers/coordination-fixture.cjs');
const {test,mock}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {predictionStatusOf}=require('../dist/modules/prediction/prediction-status');
const {PredictionService}=require('../dist/modules/prediction/prediction.service');
const {DashboardService}=require('../dist/modules/dashboard/dashboard.service');
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');
const {SIMULATED_CALENDAR_V1}=require('../dist/modules/workflow/sla/working-time');

const vn=(date,time)=>new Date(`${date}T${time}:00+07:00`);

test('predictionStatusOf: depends only on whether a prediction is stored',()=>{
  assert.equal(predictionStatusOf(false,'PA1'),'NONE');
  assert.equal(predictionStatusOf(true,'PA1'),'AVAILABLE');
  assert.equal(predictionStatusOf(true,null),'AVAILABLE');
  assert.equal(predictionStatusOf(false,null),'NONE');
  assert.equal(predictionStatusOf(false,undefined),'NONE');
});

// Dự báo v4: gửi giờ làm việc đã dùng và SLA đang áp dụng; chỉ dự báo khi công đoạn tính theo PA1.
function predictor(over = {}, stageCode = 'TIEP_NHAN') {
  const state = { fetches: 0, created: 0, payload: null, creates: [] };
  const open = { id: 'h1', enteredAt: vn('2026-10-27', '09:00'), exitedAt: null, slaPolicy: 'PA1', slaCalendarVersion: SIMULATED_CALENDAR_V1.version, slaStandardHours: stageCode === 'TIEP_NHAN' ? 80 : 40, stage: { stageCode }, netWorkDurationHours: null, ...over };
  const done = { id: 'h0', enteredAt: vn('2026-10-26', '08:00'), exitedAt: vn('2026-10-27', '09:00'), slaPolicy: 'PA1', stage: { stageCode: 'TIEP_NHAN' }, netWorkDurationHours: 12 };
  const loan = { id: 'l1', applicationCode: 'HS-1', assignedTo: 'u', currentStage: stageCode, currentStatus: 'RECEIVED', loanTermMonths: 12, proposedAmount: 2e9, officialAmount: null, supplementCount: 1,
    company: { industry: 'Sản xuất', establishedYear: 2020, annualRevenue: 5e9, charterCapital: 1e9 },
    portalRequest: { data: { businessScope: 'MANUFACTURING', hasExistingDebt: true, collateral: { mode: 'PROPOSED' } } },
    appraisalReport: stageCode === 'THAM_DINH' ? { id: 'r1', status: 'CLARIFICATION_REQUIRED' } : null,
    supplementRequests: [], stageHistories: stageCode === 'THAM_DINH' ? [open, done] : [open] };
  const prisma = { loanApplication: { findUnique: async () => loan, count: async () => 6 }, user: { count: async () => 2 }, applicationStagePause: { findMany: async () => [] },
    appraisalReportEvent: { findFirst: async () => null, count: async () => 1 }, delayPrediction: { create: async ({ data }) => { state.created++; state.creates.push(data); return { id: 'p1', ...data }; } } };
  return { state, service: new PredictionService(prisma) };
}
async function withClock(iso, fn) {
  mock.timers.enable({ apis: ['Date'], now: new Date(iso).getTime() });
  try { return await fn(); } finally { mock.timers.reset(); }
}
test('Reception stage on PA1 sends working hours, SLA and portal fields to the ML service and stores the mapped risk level', async () => {
  const { state, service } = predictor();
  const original = global.fetch;
  global.fetch = async (url, init) => { state.fetches++; state.payload = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ delay_probability: 0.7, alert_level: 'KHAN', top_reasons: ['x'], model_version: 'v4.0', remaining_hours: 76 }) }; };
  try { await withClock('2026-10-27T14:00:00+07:00', () => service.predictForApplication('l1')); } finally { global.fetch = original; }
  assert.equal(state.fetches, 1); assert.equal(state.created, 1);
  assert.equal(state.payload.stage, 'TIEP_NHAN'); assert.equal(state.payload.sla_hours, 80); assert.equal(state.payload.elapsed_hours, 4);
  assert.equal(state.payload.business_scope, 'SAN_XUAT'); assert.equal(state.payload.collateral_mode, 'PROPOSED'); assert.equal(state.payload.has_existing_debt, 1);
  assert.equal(state.payload.proposed_amount_billion, 2); assert.equal(state.payload.supplement_rounds_so_far, 1); assert.equal(state.payload.officer_workload, 6);
  assert.equal(state.creates[0].riskLevel, 'CAO'); assert.equal(state.creates[0].modelVersion, 'v4.0-TIEP_NHAN');
});
test('Appraisal stage sends queue, appraisers, clarification and Reception hours', async () => {
  const { state, service } = predictor({}, 'THAM_DINH');
  const original = global.fetch;
  global.fetch = async (url, init) => { state.payload = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ delay_probability: 0.2, alert_level: 'BINH_THUONG', top_reasons: [], model_version: 'v4.0', remaining_hours: 36 }) }; };
  try { await withClock('2026-10-27T14:00:00+07:00', () => service.predictForApplication('l1')); } finally { global.fetch = original; }
  assert.equal(state.payload.stage, 'THAM_DINH'); assert.equal(state.payload.sla_hours, 40); assert.equal(state.payload.tn_bank_hours, 12);
  assert.equal(state.payload.appraisal_queue_len, 6); assert.equal(state.payload.appraisers_active, 2); assert.equal(state.payload.clarify_open, 1); assert.equal(state.payload.clarify_rounds_so_far, 1);
  assert.equal(state.creates[0].riskLevel, 'THAP');
});
test('A stage on the legacy 24/7 calculation is not predicted and ML is not called', async () => {
  const { state, service } = predictor({ slaPolicy: null, slaCalendarVersion: null });
  const original = global.fetch; global.fetch = async () => { state.fetches++; throw new Error('ML must not be called'); };
  try {
    const result = await service.predictForApplication('l1');
    assert.equal(result.unavailable, true); assert.equal(result.reason, 'LEGACY_SLA'); assert.match(result.message, /PA1/);
  } finally { global.fetch = original; }
  assert.equal(state.fetches, 0); assert.equal(state.created, 0);
});
test('Prediction is unavailable, not invented, when now is outside the calendar coverage', async () => {
  const { state, service } = predictor();
  const original = global.fetch; global.fetch = async () => { state.fetches++; throw new Error('ML must not be called'); };
  try { const result = await withClock('2026-11-20T10:00:00+07:00', () => service.predictForApplication('l1')); assert.equal(result.reason, 'CALENDAR_OUT_OF_RANGE'); } finally { global.fetch = original; }
  assert.equal(state.fetches, 0); assert.equal(state.created, 0);
});
test('An SLA outside the range the model learned (HTTP 422) is reported as unavailable and nothing is stored', async () => {
  const { state, service } = predictor();
  const original = global.fetch; global.fetch = async () => ({ ok: false, status: 422, json: async () => ({}) });
  try { const result = await withClock('2026-10-27T14:00:00+07:00', () => service.predictForApplication('l1')); assert.equal(result.reason, 'SLA_OUT_OF_RANGE'); } finally { global.fetch = original; }
  assert.equal(state.created, 0);
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
    warnRow('real',{delayPredictions:[{riskLevel:'CAO',delayProbability:0.9,predictionTimestamp:new Date(),topReasonsJson:'[]',modelVersion:'v4.0-THAM_DINH'}],stageHistories:[{enteredAt:new Date('2026-01-01T00:00:00Z'),exitedAt:null,pauses:[],slaPolicy:null,slaStandardHours:40}]}),
  ],[{applicationId:'pa1',slaPolicy:'PA1'},{applicationId:'none',slaPolicy:null},{applicationId:'real',slaPolicy:null}]);
  const list=await service.getEarlyWarningList();
  assert.deepEqual(list.map(x=>x.id),['real','none','pa1'].sort((a,b)=>a==='real'?-1:b==='real'?1:0),'real prediction first; predictionless rows keep a stable order after it');
  const byId=Object.fromEntries(list.map(x=>[x.id,x]));
  assert.equal(byId.real.riskLevel,'CAO');assert.equal(byId.real.predictionStatus,'AVAILABLE');
  assert.equal(byId.none.riskLevel,null);assert.equal(byId.none.delayProbability,null);assert.equal(byId.none.predictionStatus,'NONE');
  assert.equal(byId.pa1.riskLevel,null);assert.equal(byId.pa1.delayProbability,null);assert.equal(byId.pa1.predictionStatus,'NONE');
});

// Chi tiết hồ sơ: trạng thái SLA và số giờ đang chạy của công đoạn PA1 mở.
function loanService({loan,pauses=[]}) {
  const prisma={loanApplication:{findUnique:async()=>loan},applicationStagePause:{findMany:async()=>pauses}};
  return new LoanApplicationsService(withCoordination(prisma));
}
const stageRow=(over={})=>({id:'h1',exitedAt:null,enteredAt:vn('2026-10-27','09:00'),pausedAt:null,pausedDurationHours:0,slaStandardHours:4,slaPolicy:'PA1',slaCalendarVersion:SIMULATED_CALENDAR_V1.version,...over});
const loanRow=(over={})=>({id:'l1',currentStatus:'RECEIVED',delayPredictions:[],stageHistories:[stageRow()],...over});
test('open PA1 stage reports live working hours at the viewing time and no waiting party',async()=>{
  const view=await loanService({loan:loanRow()}).findOne('l1',vn('2026-10-27','14:00'));
  assert.equal(view.slaState.policy,'PA1');assert.equal(view.slaState.waiting,null);assert.equal(view.slaState.slaRunning,true);
  assert.equal(view.liveSla.actualDurationHours,4);assert.equal(view.liveSla.netWorkDurationHours,4);assert.equal(view.predictionStatus,'NONE');
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
