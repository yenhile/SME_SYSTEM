const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {DashboardService}=require('../dist/modules/dashboard/dashboard.service');
const {AdminService}=require('../dist/admin.service');
const {SIMULATED_CALENDAR_V1}=require('../dist/modules/workflow/sla/working-time');

const vn=(date,time)=>new Date(`${date}T${time}:00+07:00`);
const NOW=vn('2026-10-28','14:00');
const POLICY='SME_BRANCH_20261031_V1';
const stage=(enteredAt,sla,pauses=[])=>({id:'h',enteredAt,pausedAt:null,pausedDurationHours:0,slaStandardHours:sla,slaPolicy:'PA1',slaCalendarVersion:SIMULATED_CALENDAR_V1.version,pauses});
const actor=role=>({id:'me',activeRole:role,roles:[role]});

// ---------- Cán bộ tín dụng ----------
const loan=(id,over={})=>({id,applicationCode:`HS-${id}`,companyId:'c',companySnapshot:null,company:{companyName:`DN ${id}`},currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',completedAt:null,
  assignedTo:'me',intakeOfficerId:'me',businessPolicyVersion:POLICY,proposedAmount:1e9,officialAmount:null,loanPurpose:'x',loanType:'VON_LUU_DONG',loanTermMonths:12,
  supplementRequests:[],coordinationRequests:[],appraisalReport:null,delayPredictions:[],stageHistories:[stage(vn('2026-10-28','09:00'),112)],...over});

function officerSetup(rows){
  const seen={};
  const prisma={loanApplication:{findMany:async args=>{seen.args=args;return rows;}},$queryRaw:async()=>[],company:{findUnique:async()=>({id:'c',companyName:'DN'})},document:{findMany:async()=>[]},supplementRequest:{findMany:async()=>[]}};
  return {seen,prisma,svc:new DashboardService(prisma)};
}

test('the officer dashboard is only for the credit officer role and only reads loans assigned to the caller',async()=>{
  const {svc,seen}=officerSetup([]);
  await assert.rejects(svc.getOfficerDashboard(actor('QUAN_LY'),{},NOW),{status:403});
  await svc.getOfficerDashboard(actor('CBTD'),{},NOW);
  assert.equal(seen.args.where.assignedTo,'me');
});

test('officer KPIs: assigned active loans, loans waiting on me with the task to do, my overdue, my ML warnings',async()=>{
  const {digest,reportEvidence}=require('../dist/modules/appraisal/appraisal.logic');
  const probe=officerSetup([]);
  const appraisal=(id,status,hash,over={})=>loan(id,{currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',appraisalReport:{status,versions:hash?[{evidenceHash:hash}]:[]},stageHistories:[stage(vn('2026-10-28','09:00'),40)],...over});
  const fresh=digest(await reportEvidence(probe.prisma,appraisal('probe','SUBMITTED','x')));
  const rows=[
    loan('received'),
    loan('checked',{currentStatus:'CHECKED'}),
    loan('supplement',{currentStatus:'SUPPLEMENT_REQUIRED',stageHistories:[stage(vn('2026-10-27','09:00'),112,[{startedAt:vn('2026-10-27','10:00'),endedAt:null}])]}),
    appraisal('no-report','DRAFT',null,{stageHistories:[stage(vn('2026-10-26','09:00'),16)]}),
    appraisal('clarify','CLARIFICATION_REQUIRED',fresh,{delayPredictions:[{riskLevel:'CAO',delayProbability:0.7,predictionTimestamp:vn('2026-10-28','10:00'),modelVersion:'v4.0-THAM_DINH',topReasonsJson:'[]'}]}),
    appraisal('waiting-decision','SUBMITTED',fresh),
    loan('approved',{currentStage:'HOAN_TAT',currentStatus:'APPROVED',completedAt:vn('2026-10-10','10:00'),stageHistories:[]}),
    loan('rejected',{currentStage:'HOAN_TAT',currentStatus:'REJECTED',completedAt:vn('2026-09-15','10:00'),stageHistories:[]}),
  ];
  const {svc}=officerSetup(rows);
  const result=await svc.getOfficerDashboard(actor('CBTD'),{},NOW);
  assert.deepEqual(result.kpis,{assigned:6,myTurn:4,overdue:1,mlFlagged:1});
  const tasks=Object.fromEntries(result.tasks.items.map(t=>[t.id,t.task]));
  assert.deepEqual(tasks,{'no-report':'NO_REPORT',clarify:'CLARIFICATION',received:'INTAKE_CHECK',checked:'INTAKE_FORWARD'});
  assert.equal(result.tasks.items[0].id,'no-report');
  assert.deepEqual(result.sla,{onTime:4,dueSoon:0,overdue:1,paused:1,unknown:0});
  const statuses=Object.fromEntries(result.statusDistribution.map(s=>[s.status,s.count]));
  assert.deepEqual(statuses,{RECEIVED:1,CHECKED:1,SUPPLEMENT_REQUIRED:1,PENDING_APPRAISAL:3,APPROVED:1,REJECTED:1});
  const trend=Object.fromEntries(result.completionTrend.map(m=>[m.month,m.completed]));
  assert.equal(result.completionTrend.length,6);
  assert.equal(trend['2026-10'],1);assert.equal(trend['2026-09'],1);assert.equal(trend['2026-05'],0);
});

// ---------- Cấp thẩm quyền ----------
function approverSetup(queueItems,histories){
  const seen={pages:[]};
  const loans={findAll:async(user,query)=>{seen.pages.push(query);const page=Number(query.page),size=Number(query.pageSize);return {items:queueItems.slice((page-1)*size,page*size),total:queueItems.length,page,pageSize:size};}};
  const prisma={applicationStageHistory:{findMany:async args=>{seen.historyArgs=args;return histories;}}};
  return {seen,svc:new DashboardService(prisma,loans)};
}
const queued=(id,sla,over={})=>({id,applicationCode:`HS-${id}`,loanType:'VON_LUU_DONG',slaSummary:sla,...over});
const sla=(over)=>({policy:'PA1',standardHours:40,netWorkHours:10,remainingHours:30,dueAt:new Date(),waitingEnterprise:false,isOverdue:false,error:null,...over});

test('the approver dashboard is only for the approval role',async()=>{
  const {svc}=approverSetup([],[]);
  await assert.rejects(svc.getApproverDashboard(actor('CBTD'),NOW),{status:403});
  await assert.rejects(svc.getApproverDashboard(actor('ADMIN'),NOW),{status:403});
});

test('approver queue figures come from the existing "waiting for my decision" queue, every page of it',async()=>{
  const items=[];
  for(let i=0;i<105;i++)items.push(queued(`q${i}`,sla({})));
  items[0]=queued('late',sla({isOverdue:true,netWorkHours:50,remainingHours:0}),{loanType:'DAU_TU_TSCD'});
  items[1]=queued('soon',sla({netWorkHours:34,remainingHours:6}));
  const {svc,seen}=approverSetup(items,[]);
  const result=await svc.getApproverDashboard(actor('THAM_QUYEN'),NOW);
  assert.deepEqual(seen.pages.map(p=>[p.queue,p.page]),[['DECIDE','1'],['DECIDE','2']]);
  assert.equal(result.kpis.waiting,105);assert.equal(result.kpis.overdue,1);assert.equal(result.kpis.dueSoon,1);
  assert.deepEqual(result.queueSla,{onTime:103,dueSoon:1,overdue:1,paused:0,unknown:0});
  const byType=Object.fromEntries(result.waitByLoanType.map(g=>[g.loanType,g]));
  assert.deepEqual(byType.DAU_TU_TSCD,{loanType:'DAU_TU_TSCD',count:1,avgWorkHours:50});
  assert.equal(byType.VON_LUU_DONG.count,104);assert.equal(byType.VON_LUU_DONG.avgWorkHours,10.2);
});

test('decisions are appraisal stages closed into approved or rejected, counted per month and for the caller',async()=>{
  const h=(exitedAt,status,handledBy)=>({exitedAt,handledBy,application:{currentStatus:status}});
  const {svc,seen}=approverSetup([],[
    h(vn('2026-10-20','10:00'),'APPROVED','me'),
    h(vn('2026-10-21','10:00'),'REJECTED','other'),
    h(vn('2026-08-01','10:00'),'APPROVED','other'),
    h(vn('2026-10-22','10:00'),'CLOSED_TIMEOUT','manager'),
  ]);
  const result=await svc.getApproverDashboard(actor('THAM_QUYEN'),NOW);
  assert.equal(seen.historyArgs.where.stage.stageCode,'THAM_DINH');
  assert.deepEqual(result.kpis.decided,{days:30,total:2,mine:1});
  const oct=result.decisionTrend.find(m=>m.month==='2026-10');
  assert.deepEqual(oct,{month:'2026-10',approved:1,rejected:1});
  assert.equal(result.decisionTrend.length,6);
});

// ---------- Admin ----------
test('the admin dashboard counts accounts, role assignments and admin activity, with no loan data',async()=>{
  const prisma={
    user:{findMany:async()=>[
      {isActive:true,roles:[{role:{code:'ADMIN',name:'Quản trị'}}]},
      {isActive:true,roles:[{role:{code:'CBTD',name:'CBTD'}},{role:{code:'THAM_QUYEN',name:'TQ'}}]},
      {isActive:false,roles:[{role:{code:'CBTD',name:'CBTD'}}]},
    ]},
    adminAuditLog:{findMany:async args=>{prisma.auditArgs=args;return [{createdAt:vn('2026-10-28','09:00')},{createdAt:vn('2026-10-28','11:00')},{createdAt:vn('2026-10-20','09:00')}];}},
  };
  const result=await new AdminService(prisma).dashboard(NOW);
  assert.deepEqual(result.accounts,{total:3,active:2,locked:1});
  const byRole=Object.fromEntries(result.byRole.map(r=>[r.code,r]));
  assert.deepEqual(byRole.CBTD,{code:'CBTD',name:'CBTD',active:1,locked:1});
  assert.equal(result.activity.length,30);
  assert.equal(result.activity.at(-1).day,'2026-10-28');assert.equal(result.activity.at(-1).count,2);
  assert.equal(result.activityTotal,3);
  assert.ok(prisma.auditArgs.where.createdAt.gte instanceof Date);
  assert.equal(JSON.stringify(result).includes('loan'),false);
});
