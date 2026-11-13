const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {parseReportRange,buildPeriodReport,vnDateKey}=require('../dist/modules/dashboard/dashboard-report');
const {DashboardService}=require('../dist/modules/dashboard/dashboard.service');

const NOW=new Date('2026-11-06T10:00:00Z');   // 17:00 giờ Việt Nam
const vn=(d,t='09:00')=>new Date(`${d}T${t}:00+07:00`);

test('range defaults to the last 30 days, includes the end day, and works in Vietnam time',()=>{
  const r=parseReportRange(undefined,undefined,NOW);
  assert.equal(r.to,'2026-11-06');assert.equal(r.from,'2026-10-08');assert.equal(r.days,30);
  assert.equal(r.end.toISOString(),'2026-11-06T17:00:00.000Z');   // 00:00 ngày 07/11 giờ Việt Nam
  assert.equal(vnDateKey(new Date('2026-10-31T17:30:00Z')),'2026-11-01');
});
test('invalid ranges are rejected with a clear message',()=>{
  const bad=(f,t,re)=>assert.throws(()=>parseReportRange(f,t,NOW),re);
  bad('2026-13-01','2026-11-01',/không hợp lệ/);bad('abc',undefined,/không hợp lệ/);bad('2026-02-30','2026-03-01',/không hợp lệ/);
  bad('2026-11-05','2026-11-01',/trước hoặc bằng/);bad('2026-11-01','2026-11-07',/tương lai/);bad('2025-01-01','2026-11-06',/tối đa 366/);
  assert.equal(parseReportRange('2026-11-06','2026-11-06',NOW).days,1);
});

const loan=(over)=>({createdAt:vn('2026-10-10'),completedAt:null,currentStatus:'RECEIVED',loanType:'VAY_VON_LUU_DONG',proposedAmount:1e9,approvedAmount:null,assignedTo:'u1',...over});
test('report totals, approval rate, stages, officers, loan types and months add up',()=>{
  const range=parseReportRange('2026-09-20','2026-11-06',NOW);
  const created=[loan({}),loan({createdAt:vn('2026-09-25'),assignedTo:'u2'}),loan({createdAt:vn('2026-11-02'),loanType:'THAU_CHI'})];
  const completed=[
    loan({completedAt:vn('2026-10-20'),currentStatus:'APPROVED',approvedAmount:2e9}),
    loan({completedAt:vn('2026-10-21'),currentStatus:'APPROVED',approvedAmount:3e9,assignedTo:'u2'}),
    loan({completedAt:vn('2026-11-03'),currentStatus:'REJECTED'}),
    loan({completedAt:vn('2026-11-04'),currentStatus:'CLOSED_TIMEOUT'}),
  ];
  const stages=[
    {stageCode:'TIEP_NHAN',handledBy:'u1',netWorkDurationHours:30,isDelayed:false},{stageCode:'TIEP_NHAN',handledBy:'u1',netWorkDurationHours:50,isDelayed:true},
    {stageCode:'THAM_DINH',handledBy:'t1',netWorkDurationHours:20,isDelayed:false},
  ];
  const r=buildPeriodReport({range,created,completed,stages,officerNames:{u1:'An',u2:'Bình',t1:'Hà'}});
  assert.deepEqual({c:r.totals.created,d:r.totals.completed,a:r.totals.approved,j:r.totals.rejected,t:r.totals.closedTimeout},{c:3,d:4,a:2,j:1,t:1});
  assert.equal(r.totals.approvalRate,66.7);assert.equal(r.totals.approvedAmount,5e9);
  const tn=r.stages.find(s=>s.stageCode==='TIEP_NHAN');assert.deepEqual({h:tn.handled,d:tn.delayed,rate:tn.delayRate,avg:tn.avgNetWorkHours},{h:2,d:1,rate:50,avg:40});
  assert.equal(r.stages.find(s=>s.stageCode==='THAM_DINH').delayRate,0);
  const an=r.byOfficer.find(o=>o.id==='u1');assert.deepEqual({created:an.created,completed:an.completed,approved:an.approved,rej:an.rejected,rh:an.receptionHandled,rd:an.receptionDelayed},{created:2,completed:3,approved:1,rej:1,rh:2,rd:1});
  assert.equal(r.byOfficer.some(o=>o.id==='t1'),false,'a reviewer with no reception work or own loans is not listed as an officer');
  assert.deepEqual(r.byLoanType.map(x=>[x.loanType,x.created,x.approved,x.approvedAmount]),[['THAU_CHI',1,0,0],['VAY_VON_LUU_DONG',2,2,5e9]]);
  assert.deepEqual(r.monthly.map(m=>[m.month,m.created,m.completed]),[['2026-09',1,0],['2026-10',1,2],['2026-11',1,2]]);
});
test('an empty period gives zeros and null rates, never NaN',()=>{
  const r=buildPeriodReport({range:parseReportRange('2026-11-01','2026-11-06',NOW),created:[],completed:[],stages:[],officerNames:{}});
  assert.equal(r.totals.approvalRate,null);assert.equal(r.stages[0].delayRate,null);assert.equal(r.stages[0].avgNetWorkHours,null);assert.equal(JSON.stringify(r).includes('NaN'),false);
});
test('the service queries by Vietnam-time boundaries and only PA1 stages',async()=>{
  const seen={};
  const prisma={
    loanApplication:{findMany:async(a)=>{(seen.loans??=[]).push(a);return[];}},
    applicationStageHistory:{findMany:async(a)=>{seen.stages=a;return[];}},
    user:{findMany:async()=>[]},
  };
  const svc=new DashboardService(prisma);
  const r=await svc.getPeriodReport('2026-11-01','2026-11-06',NOW);
  assert.equal(seen.loans[0].where.createdAt.gte.toISOString(),'2026-10-31T17:00:00.000Z');
  assert.equal(seen.loans[1].where.completedAt.lt.toISOString(),'2026-11-06T17:00:00.000Z');
  assert.equal(seen.stages.where.slaPolicy,'PA1');
  assert.equal(r.range.days,6);
  await assert.rejects(()=>svc.getPeriodReport('2026-12-01','2026-12-02',NOW),/tương lai/);
});

test('the trend is daily for short periods and monthly for long ones, every bucket present, each case counted once',()=>{
  const short=parseReportRange('2026-10-31','2026-11-06',NOW);
  const created=[loan({createdAt:vn('2026-11-01')}),loan({createdAt:vn('2026-11-01','23:30')}),loan({createdAt:vn('2026-11-06')})];
  const completed=[loan({completedAt:vn('2026-11-02'),currentStatus:'APPROVED',approvedAmount:1e9}),loan({completedAt:vn('2026-11-02'),currentStatus:'REJECTED'}),loan({completedAt:vn('2026-11-03'),currentStatus:'CLOSED_TIMEOUT'})];
  const daily=buildPeriodReport({range:short,created,completed,stages:[],officerNames:{}}).trend;
  assert.equal(daily.granularity,'day');
  assert.deepEqual(daily.buckets.map(b=>b.key),['2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06']);
  const nov1=daily.buckets.find(b=>b.key==='2026-11-01');assert.equal(nov1.created,2);
  const nov2=daily.buckets.find(b=>b.key==='2026-11-02');assert.deepEqual({c:nov2.completed,a:nov2.approved,r:nov2.rejected},{c:2,a:1,r:1});
  assert.equal(daily.buckets.reduce((s,b)=>s+b.created,0),3);
  assert.equal(daily.buckets.reduce((s,b)=>s+b.completed,0),3);
  const long=parseReportRange('2026-01-01','2026-11-06',NOW);
  const monthly=buildPeriodReport({range:long,created,completed,stages:[],officerNames:{}}).trend;
  assert.equal(monthly.granularity,'month');assert.equal(monthly.buckets.length,11);assert.equal(monthly.buckets.at(-1).key,'2026-11');
});

test('stage on-time figures are counted in stage passes, separately from cases',()=>{
  const range=parseReportRange('2026-10-31','2026-11-06',NOW);
  const stages=[{stageCode:'TIEP_NHAN',handledBy:'u1',netWorkDurationHours:10,isDelayed:false},{stageCode:'TIEP_NHAN',handledBy:'u1',netWorkDurationHours:120,isDelayed:true},{stageCode:'THAM_DINH',handledBy:'t',netWorkDurationHours:30,isDelayed:false}];
  const report=buildPeriodReport({range,created:[],completed:[],stages,officerNames:{}});
  assert.deepEqual(report.onTime,{unit:'stagePass',handled:3,onTime:2,rate:66.7});
});
