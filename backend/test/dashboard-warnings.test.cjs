const {test,mock}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {DashboardService}=require('../dist/modules/dashboard/dashboard.service');
const {SIMULATED_CALENDAR_V1}=require('../dist/modules/workflow/sla/working-time');

const vn=(date,time)=>new Date(`${date}T${time}:00+07:00`);
async function atClock(iso,fn){mock.timers.enable({apis:['Date'],now:new Date(iso).getTime()});try{return await fn();}finally{mock.timers.reset();}}
function service(rows){
  const seen={};
  const prisma={loanApplication:{findMany:async(args)=>{seen.args=args;return rows;}}};
  return {seen,svc:new DashboardService(prisma)};
}
const row=(id,over={})=>({id,applicationCode:`HS-${id}`,company:{companyName:'ABC',industry:'x'},officialAmount:null,proposedAmount:1e9,currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',
  supplementCount:0,assignedUser:{id:'u1',fullName:'Nguyễn A',username:'a'},assignedTo:'u1',
  delayPredictions:[{riskLevel:'CAO',delayProbability:0.7,predictionTimestamp:new Date(),topReasonsJson:'[]',modelVersion:'v4.0-THAM_DINH'}],
  stageHistories:[{id:'h',enteredAt:vn('2026-10-27','09:00'),pausedAt:null,pausedDurationHours:0,slaStandardHours:40,slaPolicy:'PA1',slaCalendarVersion:SIMULATED_CALENDAR_V1.version,pauses:[]}],...over});

test('CBTD warnings are restricted to loans assigned to the caller and carry SLA hours left',async()=>{
  const {svc,seen}=service([row('a')]);
  const list=await atClock('2026-10-27T14:00:00+07:00',()=>svc.getEarlyWarningList({activeRole:'CBTD'},'u1'));
  assert.equal(seen.args.where.assignedTo,'u1');
  assert.equal(list[0].modelVersion,'v4.0-THAM_DINH');assert.equal(list[0].slaRemainingHours,36);assert.equal(list[0].slaOverdue,false);assert.equal(list[0].slaWaiting,false);
});
test('without the owner filter the query is not restricted (Manager/Appraiser dashboard unchanged)',async()=>{
  const {svc,seen}=service([row('a')]);
  await svc.getEarlyWarningList({activeRole:'QUAN_LY'});
  assert.equal('assignedTo' in seen.args.where,false);
});
test('a loan waiting for the enterprise reports no remaining hours instead of a made-up number',async()=>{
  const waiting=row('w',{currentStage:'TIEP_NHAN',currentStatus:'SUPPLEMENT_REQUIRED',stageHistories:[{id:'h',enteredAt:vn('2026-10-27','09:00'),pausedAt:vn('2026-10-27','10:00'),pausedDurationHours:0,slaStandardHours:112,slaPolicy:'PA1',slaCalendarVersion:SIMULATED_CALENDAR_V1.version,pauses:[{startedAt:vn('2026-10-27','10:00'),endedAt:null}]}]});
  const {svc}=service([waiting]);
  const [item]=await atClock('2026-10-27T14:00:00+07:00',()=>svc.getEarlyWarningList({activeRole:'CBTD'},'u1'));
  assert.equal(item.slaRemainingHours,null);assert.equal(item.slaWaiting,true);
});

test('a stale warning (older model or previous stage) is not shown as the current warning',async()=>{
  const stale=(id,modelVersion,at)=>row(id,{delayPredictions:[{riskLevel:'CAO',delayProbability:0.84,predictionTimestamp:at,topReasonsJson:'[]',modelVersion}]});
  const {svc}=service([
    stale('old-model','v1.0',new Date()),
    stale('old-stage','v4.0-TIEP_NHAN',new Date()),
    stale('before-entry','v4.0-THAM_DINH',vn('2026-10-20','09:00')),
    row('current'),
  ]);
  const list=await atClock('2026-10-27T14:00:00+07:00',()=>svc.getEarlyWarningList({activeRole:'QUAN_LY'}));
  const byId=Object.fromEntries(list.map(x=>[x.id,x]));
  for(const id of ['old-model','old-stage','before-entry']){assert.equal(byId[id].riskLevel,null,id);assert.equal(byId[id].predictionStatus,'NONE',id);}
  assert.equal(byId.current.riskLevel,'CAO');
});
test('loans already past their SLA are listed first',async()=>{
  const past=row('late',{stageHistories:[{id:'h',enteredAt:vn('2026-10-26','09:00'),pausedAt:null,pausedDurationHours:0,slaStandardHours:40,slaPolicy:'PA1',slaCalendarVersion:SIMULATED_CALENDAR_V1.version,pauses:[]}],delayPredictions:[{riskLevel:'THAP',delayProbability:0.1,predictionTimestamp:new Date(),topReasonsJson:'[]',modelVersion:'v4.0-THAM_DINH'}]});
  const {svc}=service([row('fresh',{stageHistories:[{id:'h2',enteredAt:vn('2026-11-05','09:00'),pausedAt:null,pausedDurationHours:0,slaStandardHours:40,slaPolicy:'PA1',slaCalendarVersion:SIMULATED_CALENDAR_V1.version,pauses:[]}]}),past]);
  const list=await atClock('2026-11-05T14:00:00+07:00',()=>svc.getEarlyWarningList({activeRole:'QUAN_LY'}));
  assert.equal(list[0].id,'late');assert.equal(list[0].slaOverdue,true);
});

test('the CBTD priority list keeps only loans waiting on the officer, not on the enterprise or the approver',async()=>{
  const {digest,reportEvidence}=require('../dist/modules/appraisal/appraisal.logic');
  const policy='SME_BRANCH_20261031_V1';
  const prisma={
    $queryRaw:async()=>[],
    company:{findUnique:async()=>({id:'c',companyName:'ABC'})},
    document:{findMany:async()=>[]},
    supplementRequest:{findMany:async()=>[]},
  };
  const appraisal=(id,status,hash)=>row(id,{businessPolicyVersion:policy,intakeOfficerId:'u1',companyId:'c',supplementRequests:[],coordinationRequests:[],appraisalReport:{status,versions:[{evidenceHash:hash}]}});
  const fresh=digest(await reportEvidence(prisma,appraisal('probe','SUBMITTED','x')));
  const intake=(id,status)=>row(id,{currentStage:'TIEP_NHAN',currentStatus:status,businessPolicyVersion:policy,supplementRequests:[],coordinationRequests:[],appraisalReport:null});
  const rows=[
    intake('received','RECEIVED'),intake('checked','CHECKED'),intake('supplement','SUPPLEMENT_REQUIRED'),
    appraisal('waiting-decision','SUBMITTED',fresh),appraisal('clarify','CLARIFICATION_REQUIRED',fresh),appraisal('evidence-changed','SUBMITTED','stale'),
  ];
  let args;
  prisma.loanApplication={findMany:async a=>{args=a;return rows;}};
  const svc=new DashboardService(prisma);
  const list=await atClock('2026-10-27T14:00:00+07:00',()=>svc.getEarlyWarningList({activeRole:'CBTD'},'u1',{officerTurnOnly:true}));
  assert.deepEqual(list.map(x=>x.id).sort(),['checked','clarify','evidence-changed','received']);
  assert.equal(args.where.assignedTo,'u1');
});
