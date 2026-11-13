const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {DashboardService}=require('../dist/modules/dashboard/dashboard.service');
const {SIMULATED_CALENDAR_V1}=require('../dist/modules/workflow/sla/working-time');

const vn=(date,time)=>new Date(`${date}T${time}:00+07:00`);
const NOW=vn('2026-10-28','14:00');
const stage=(enteredAt,sla,pauses=[])=>({id:'h',enteredAt,pausedAt:null,pausedDurationHours:0,slaStandardHours:sla,slaPolicy:'PA1',slaCalendarVersion:SIMULATED_CALENDAR_V1.version,pauses});
const prediction=(riskLevel,modelVersion,at=vn('2026-10-28','09:30'))=>({riskLevel,delayProbability:riskLevel==='CAO'?0.7:riskLevel==='TRUNG_BINH'?0.4:0.1,predictionTimestamp:at,modelVersion,topReasonsJson:'["Chờ lâu"]'});
const row=(id,over={})=>({id,applicationCode:`HS-${id}`,companySnapshot:null,company:{companyName:`DN ${id}`},currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',
  assignedTo:'u1',assignedUser:{id:'u1',fullName:'Nguyễn A'},delayPredictions:[],stageHistories:[stage(vn('2026-10-28','09:00'),40)],...over});

function setup(rows,decideTotal=0){
  const seen={};
  const prisma={loanApplication:{findMany:async args=>{seen.args=args;return rows;}},portalRequest:{count:async args=>{seen.portal=args;return 2;}}};
  const loans={findAll:async(user,query)=>{seen.queue={user,query};return {items:[],total:decideTotal,page:1,pageSize:1};}};
  return {seen,svc:new DashboardService(prisma,loans)};
}
const actor=role=>({id:'me',activeRole:role,roles:[role]});

test('only internal dashboard roles may read the operations dashboard, checked on the active role',async()=>{
  const {svc}=setup([]);
  await assert.rejects(svc.getOperations(actor('CBTD'),{},NOW),{status:403});
  await svc.getOperations(actor('ADMIN'),{},NOW);
});

test('the approver scope never includes loans still at intake, and asking for intake is refused',async()=>{
  const {svc,seen}=setup([]);
  const result=await svc.getOperations(actor('THAM_QUYEN'),{},NOW);
  assert.deepEqual(seen.args.where.currentStage,{in:['THAM_DINH']});
  assert.deepEqual(result.scope.stages,['THAM_DINH']);
  assert.deepEqual(result.stageDistribution.map(s=>s.stage),['THAM_DINH']);
  await assert.rejects(svc.getOperations(actor('THAM_QUYEN'),{stage:'TIEP_NHAN'},NOW),{status:400});
});

test('manager scope covers both open stages of active loans only',async()=>{
  const {svc,seen}=setup([]);
  const result=await svc.getOperations(actor('QUAN_LY'),{},NOW);
  assert.deepEqual(seen.args.where.currentStage,{in:['TIEP_NHAN','THAM_DINH']});
  assert.equal(seen.args.where.completedAt,null);
  assert.deepEqual([...seen.args.where.currentStatus.in].sort(),['CHECKED','PENDING_APPRAISAL','RECEIVED','SUPPLEMENT_REQUIRED']);
  assert.deepEqual(result.scope.stages,['TIEP_NHAN','THAM_DINH']);
  await assert.rejects(svc.getOperations(actor('QUAN_LY'),{stage:'HOAN_TAT'},NOW),{status:400});
});

test('waiting for supplements is a status inside its stage, not an extra stage',async()=>{
  const {svc}=setup([
    row('a',{currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',stageHistories:[stage(vn('2026-10-28','09:00'),112)]}),
    row('b',{currentStage:'TIEP_NHAN',currentStatus:'SUPPLEMENT_REQUIRED',stageHistories:[stage(vn('2026-10-27','09:00'),112,[{startedAt:vn('2026-10-27','10:00'),endedAt:null}])]}),
    row('c'),
  ]);
  const result=await svc.getOperations(actor('QUAN_LY'),{},NOW);
  assert.deepEqual(result.stageDistribution,[{stage:'TIEP_NHAN',total:2,waitingEnterprise:1},{stage:'THAM_DINH',total:1,waitingEnterprise:0}]);
  assert.equal(result.kpis.active,3);
});

test('SLA states come from the stage clock: overdue, paused while waiting for the enterprise, on time, unknown',async()=>{
  const {svc}=setup([
    row('late',{stageHistories:[stage(vn('2026-10-26','09:00'),16)]}),
    row('paused',{currentStatus:'SUPPLEMENT_REQUIRED',stageHistories:[stage(vn('2026-10-26','09:00'),16,[{startedAt:vn('2026-10-26','10:00'),endedAt:null}])]}),
    row('fine'),
    row('nohistory',{stageHistories:[]}),
  ]);
  const result=await svc.getOperations(actor('QUAN_LY'),{},NOW);
  assert.deepEqual(result.sla,{onTime:1,dueSoon:0,overdue:1,paused:1,unknown:1});
  assert.equal(result.kpis.overdue,1);
  const late=result.priority.items.find(i=>i.id==='late');
  assert.equal(late.slaState,'OVERDUE');
  const fine=result.priority.items.find(i=>i.id==='fine');
  assert.equal(fine.slaState,'ON_TIME');assert.ok(fine.slaDueAt);assert.equal(fine.slaRemainingHours,36);
});

test('ML counts use only the current-stage v4 prediction; missing or stale ones are "no prediction", never "normal"',async()=>{
  const {svc}=setup([
    row('urgent',{delayPredictions:[prediction('CAO','v4.0-THAM_DINH')]}),
    row('watch',{currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',stageHistories:[stage(vn('2026-10-28','07:00'),112)],delayPredictions:[prediction('TRUNG_BINH','v4.0-TIEP_NHAN')]}),
    row('normal',{delayPredictions:[prediction('THAP','v4.0-THAM_DINH')]}),
    row('old-stage',{delayPredictions:[prediction('CAO','v4.0-TIEP_NHAN')]}),
    row('old-model',{delayPredictions:[prediction('CAO','v1.0')]}),
    row('none'),
    row('late-urgent',{stageHistories:[stage(vn('2026-10-26','09:00'),16)],delayPredictions:[prediction('CAO','v4.0-THAM_DINH',vn('2026-10-26','10:00'))]}),
  ]);
  const result=await svc.getOperations(actor('QUAN_LY'),{},NOW);
  // Hồ sơ đã quá hạn là sự kiện thực tế, không phải một mức dự báo: tách ra, phần còn lại chia đúng các mức dự báo.
  assert.deepEqual(result.ml,{overdueExcluded:1,predictedScope:6,urgent:1,watch:1,normal:1,none:3});
  // KPI chỉ đếm cảnh báo của mô hình trên hồ sơ chưa quá hạn để không trùng với ô Quá hạn SLA.
  assert.deepEqual(result.kpis.ml,{flagged:2,urgent:1,watch:1,none:3});
  const byId=Object.fromEntries(result.priority.items.map(i=>[i.id,i]));
  assert.equal(byId['old-stage'].mlLevel,'NONE');assert.equal(byId['old-model'].delayProbability,null);
  assert.equal(byId.urgent.mlLevel,'KHAN');assert.equal(byId.urgent.topReason,'Chờ lâu');
});

test('priority order: overdue, then urgent, watch, normal, no prediction; ties by less SLA time left; paged on the server',async()=>{
  const {svc}=setup([
    row('none'),
    row('normal',{delayPredictions:[prediction('THAP','v4.0-THAM_DINH')]}),
    row('urgent-later',{delayPredictions:[prediction('CAO','v4.0-THAM_DINH')]}),
    row('urgent-sooner',{stageHistories:[stage(vn('2026-10-27','09:00'),40)],delayPredictions:[prediction('CAO','v4.0-THAM_DINH')]}),
    row('late',{stageHistories:[stage(vn('2026-10-26','09:00'),16)]}),
  ]);
  const first=await svc.getOperations(actor('QUAN_LY'),{page:'1',pageSize:'2'},NOW);
  assert.deepEqual(first.priority.items.map(i=>i.id),['late','urgent-sooner']);
  assert.equal(first.priority.total,5);assert.equal(first.priority.page,1);assert.equal(first.priority.pageSize,2);
  const last=await svc.getOperations(actor('QUAN_LY'),{page:'3',pageSize:'2'},NOW);
  assert.deepEqual(last.priority.items.map(i=>i.id),['none']);
  await assert.rejects(svc.getOperations(actor('QUAN_LY'),{pageSize:'500'},NOW),{status:400});
  await assert.rejects(svc.getOperations(actor('QUAN_LY'),{page:'0'},NOW),{status:400});
});

test('officer filter narrows every figure while the officer choices still list everyone in scope',async()=>{
  const {svc}=setup([
    row('mine',{stageHistories:[stage(vn('2026-10-26','09:00'),16)]}),
    row('other',{assignedTo:'u2',assignedUser:{id:'u2',fullName:'Trần B'}}),
    row('unassigned',{assignedTo:null,assignedUser:null}),
  ]);
  const result=await svc.getOperations(actor('QUAN_LY'),{officerId:'u2'},NOW);
  assert.equal(result.kpis.active,1);assert.equal(result.kpis.overdue,0);
  assert.deepEqual(result.priority.items.map(i=>i.id),['other']);
  assert.deepEqual(result.officers,[{id:'u1',name:'Nguyễn A'},{id:'u2',name:'Trần B'}]);
  assert.equal(result.filters.officerId,'u2');
});

test('"waiting on me" reuses the appraisal queue rule for approvers and is not invented for other roles',async()=>{
  const approver=setup([],4);
  const mine=await approver.svc.getOperations(actor('THAM_QUYEN'),{},NOW);
  assert.deepEqual(mine.kpis.myTurn,{status:'AVAILABLE',value:4});
  assert.equal(approver.seen.queue.query.queue,'DECIDE');assert.equal(approver.seen.queue.user.id,'me');
  const manager=await setup([]).svc.getOperations(actor('QUAN_LY'),{},NOW);
  assert.deepEqual(manager.kpis.myTurn,{status:'PENDING_PO',value:null});
  const admin=await setup([]).svc.getOperations(actor('ADMIN'),{},NOW);
  assert.deepEqual(admin.kpis.myTurn,{status:'NOT_APPLICABLE',value:null});
});

test('SLA by stage and workload by officer split the same loans without losing or double counting any',async()=>{
  const {svc,seen}=setup([
    row('a',{currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',stageHistories:[stage(vn('2026-10-28','09:00'),112)]}),
    row('b',{currentStage:'TIEP_NHAN',currentStatus:'SUPPLEMENT_REQUIRED',assignedTo:'u2',assignedUser:{id:'u2',fullName:'Trần B'},stageHistories:[stage(vn('2026-10-26','09:00'),112,[{startedAt:vn('2026-10-26','10:00'),endedAt:null}])]}),
    row('c',{stageHistories:[stage(vn('2026-10-26','09:00'),16)]}),
    row('d',{assignedTo:null,assignedUser:null}),
  ]);
  const result=await svc.getOperations(actor('QUAN_LY'),{},NOW);
  assert.deepEqual(result.slaByStage,[{stage:'TIEP_NHAN',onTime:1,dueSoon:0,overdue:0,paused:1,unknown:0},{stage:'THAM_DINH',onTime:1,dueSoon:0,overdue:1,paused:0,unknown:0}]);
  assert.deepEqual(result.officerLoad,[
    {officerId:'u1',name:'Nguyễn A',total:2,onTime:1,dueSoon:0,overdue:1,paused:0,unknown:0},
    {officerId:'u2',name:'Trần B',total:1,onTime:0,dueSoon:0,overdue:0,paused:1,unknown:0},
    {officerId:null,name:null,total:1,onTime:1,dueSoon:0,overdue:0,paused:0,unknown:0},
  ]);
  assert.deepEqual(result.unassigned,{loans:1,portalRequests:2});
  assert.equal(seen.portal.where.status,'SUBMITTED');
});

test('the approver dashboard data carries no branch assignment figures',async()=>{
  const {svc,seen}=setup([row('a')]);
  const result=await svc.getOperations(actor('THAM_QUYEN'),{},NOW);
  assert.equal(result.unassigned,null);assert.equal(seen.portal,undefined);
});

test('"due soon" is a working-hour stage, not late, not paused, with at most 8 working hours left; the four states never overlap',async()=>{
  const legacy={...stage(vn('2026-10-28','09:00'),10),slaPolicy:null,slaCalendarVersion:null};
  const {svc}=setup([
    row('eight-left',{stageHistories:[stage(vn('2026-10-28','09:00'),12)]}),
    row('nine-left',{stageHistories:[stage(vn('2026-10-28','09:00'),13)]}),
    row('legacy',{stageHistories:[legacy]}),
    row('paused',{currentStatus:'SUPPLEMENT_REQUIRED',stageHistories:[stage(vn('2026-10-28','09:00'),12,[{startedAt:vn('2026-10-28','10:00'),endedAt:null}])]}),
    row('late',{stageHistories:[stage(vn('2026-10-26','09:00'),16)]}),
  ]);
  const result=await svc.getOperations(actor('QUAN_LY'),{},NOW);
  const byId=Object.fromEntries(result.priority.items.map(i=>[i.id,i]));
  assert.equal(byId['eight-left'].slaState,'DUE_SOON');assert.equal(byId['eight-left'].slaRemainingHours,8);
  assert.equal(byId['nine-left'].slaState,'ON_TIME');
  assert.equal(byId.legacy.slaState,'ON_TIME');
  assert.equal(byId.paused.slaState,'PAUSED');
  assert.deepEqual(result.sla,{onTime:2,dueSoon:1,overdue:1,paused:1,unknown:0});
  assert.equal(Object.values(result.sla).reduce((a,b)=>a+b,0),result.kpis.active);
  assert.equal(result.kpis.dueSoon,1);
  // Sắp hết hạn vẫn được mô hình xếp mức như hồ sơ chưa quá hạn.
  assert.equal(result.ml.predictedScope,4);
});
