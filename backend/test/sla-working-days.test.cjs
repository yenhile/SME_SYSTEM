const {withCoordination}=require('./helpers/coordination-fixture.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {validate}=require('class-validator');
const {plainToInstance}=require('class-transformer');
const {BadRequestException}=require('@nestjs/common');
const {AdminController,UpdateSlaDto}=require('../dist/admin.controller');
const {AdminService}=require('../dist/admin.service');
const {OPERATING_CALENDAR_2026:calendar,workingDeadline,workingHoursBetween,CalendarCoverageError}=require('../dist/modules/workflow/sla/working-time');
const {calendarByVersion,computeStageClosing,resolveStageSla,stageSlaSummary}=require('../dist/modules/workflow/sla/sla-policy');
const {SupplementsService}=require('../dist/modules/supplements/supplements.service');
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');
const {transferLoan}=require('../dist/modules/assignments/assignment.transactions');
const {AppraisalService}=require('../dist/modules/appraisal/appraisal.service');
const BRANCH_POLICY='SME_BRANCH_20261031_V1';

const vn=text=>new Date(`${text}+07:00`);
const TIEP_NHAN=112,THAM_DINH=40;
const stage=(enteredAt,standard,over={})=>({enteredAt,pausedAt:null,pausedDurationHours:0,slaStandardHours:standard,slaPolicy:'PA1',slaCalendarVersion:calendar.version,...over});
const iso=date=>date.toISOString();

test('the 2026 calendar is registered with exactly the approved holidays',()=>{
  assert.equal(calendarByVersion(calendar.version),calendar);
  assert.equal(calendar.coverageFrom,'2026-01-01');assert.equal(calendar.coverageTo,'2026-12-31');
  assert.deepEqual([...calendar.holidays],['2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-04-27','2026-04-30','2026-05-01','2026-09-01','2026-09-02','2026-11-24']);
});
test('the extended calendar keeps every 2026 holiday and adds only 01/01/2027 up to 31/01/2027',()=>{
  const ext=calendarByVersion('VN-20260101-20270131-v2');
  assert.equal(calendarByVersion(calendar.version),calendar);
  assert.equal(ext.coverageFrom,'2026-01-01');assert.equal(ext.coverageTo,'2027-01-31');
  assert.deepEqual([...ext.holidays],[...calendar.holidays,'2027-01-01']);
});
test('extended calendar: Tiếp nhận entering 23/12/2026 08:00 ends 12/01/2027 17:00, skipping weekends and 01/01',()=>{
  const ext=calendarByVersion('VN-20260101-20270131-v2');
  assert.equal(iso(workingDeadline(vn('2026-12-23T08:00:00'),TIEP_NHAN,ext)),iso(vn('2027-01-12T17:00:00')));
  assert.equal(workingHoursBetween(vn('2027-01-01T00:00:00'),vn('2027-01-02T00:00:00'),ext),0);
  assert.throws(()=>workingDeadline(vn('2026-12-23T08:00:00'),TIEP_NHAN,calendar),CalendarCoverageError);
});
test('extended calendar: a stage still open on 31/01/2027 cannot be measured into February',()=>{
  const ext=calendarByVersion('VN-20260101-20270131-v2');
  assert.equal(workingHoursBetween(vn('2027-01-29T08:00:00'),vn('2027-01-31T23:59:00'),ext),8);
  assert.throws(()=>workingHoursBetween(vn('2027-01-29T08:00:00'),vn('2027-02-01T09:00:00'),ext),CalendarCoverageError);
});
test('23/11 is a working day and 24/11 is not',()=>{
  assert.equal(workingHoursBetween(vn('2026-11-23T00:00:00'),vn('2026-11-24T00:00:00'),calendar),8);
  assert.equal(workingHoursBetween(vn('2026-11-24T00:00:00'),vn('2026-11-25T00:00:00'),calendar),0);
});

test('Tiếp nhận: entering Monday 16/11 08:00 with 14 working days ends Friday 04/12 17:00',()=>{
  assert.equal(iso(workingDeadline(vn('2026-11-16T08:00:00'),TIEP_NHAN,calendar)),iso(vn('2026-12-04T17:00:00')));
});
test('Thẩm định: entering Wednesday 25/11 10:00 with 5 working days ends Wednesday 02/12 10:00',()=>{
  assert.equal(iso(workingDeadline(vn('2026-11-25T10:00:00'),THAM_DINH,calendar)),iso(vn('2026-12-02T10:00:00')));
});
test('the deadline stays on the end of a session instead of moving to the next one',()=>{
  assert.equal(iso(workingDeadline(vn('2026-11-16T08:00:00'),4,calendar)),iso(vn('2026-11-16T12:00:00')));
  assert.equal(iso(workingDeadline(vn('2026-11-16T08:00:00'),8,calendar)),iso(vn('2026-11-16T17:00:00')));
});
test('entering outside working hours starts counting at the next working moment',()=>{
  assert.equal(iso(workingDeadline(vn('2026-11-20T18:30:00'),4,calendar)),iso(vn('2026-11-23T12:00:00')));
  assert.equal(iso(workingDeadline(vn('2026-11-16T12:30:00'),4,calendar)),iso(vn('2026-11-16T17:00:00')));
  assert.equal(iso(workingDeadline(vn('2026-11-24T09:00:00'),4,calendar)),iso(vn('2026-11-25T12:00:00')));
});
test('a finished pause pushes the deadline by the working hours it covered',()=>{
  const pauses=[{start:vn('2026-11-25T10:00:00'),end:vn('2026-11-26T10:00:00')}];
  const dueAt=workingDeadline(vn('2026-11-25T08:00:00'),8,calendar,pauses);
  assert.equal(iso(dueAt),iso(vn('2026-11-26T17:00:00')));
  assert.equal(workingHoursBetween(vn('2026-11-25T08:00:00'),dueAt,calendar,pauses),8);
});
test('a deadline past the calendar reports coverage instead of guessing',()=>{
  assert.throws(()=>workingDeadline(vn('2026-12-14T08:01:00'),TIEP_NHAN,calendar),CalendarCoverageError);
  assert.equal(iso(workingDeadline(vn('2026-12-14T08:00:00'),TIEP_NHAN,calendar)),iso(vn('2026-12-31T17:00:00')));
});

const due=vn('2026-12-02T10:00:00'),entered=vn('2026-11-25T10:00:00');
test('closing exactly at the deadline is on time; one minute later is late and labelled',()=>{
  assert.equal(computeStageClosing(stage(entered,THAM_DINH),[],due).isDelayed,false);
  assert.equal(stageSlaSummary(stage(entered,THAM_DINH),[],due).isOverdue,false);
  const late=new Date(due.getTime()+60000);
  assert.equal(computeStageClosing(stage(entered,THAM_DINH),[],late).isDelayed,true);
  const summary=stageSlaSummary(stage(entered,THAM_DINH),[],late);
  assert.equal(summary.isOverdue,true);assert.equal(iso(summary.dueAt),iso(due));assert.equal(summary.remainingHours,0);
});
test('waiting for the enterprise stops the clock, hides the label and leaves the deadline open',()=>{
  const pauses=[{start:vn('2026-11-26T10:00:00'),end:null}];
  const summary=stageSlaSummary(stage(entered,THAM_DINH),pauses,vn('2026-12-20T10:00:00'));
  assert.equal(summary.waitingEnterprise,true);assert.equal(summary.isOverdue,false);assert.equal(summary.dueAt,null);
  assert.equal(summary.netWorkHours,8);assert.equal(summary.remainingHours,32);
});
test('a stage already late before the pause hides the label while paused and shows it again afterwards',()=>{
  const start=vn('2026-12-03T10:00:00');
  const paused=stageSlaSummary(stage(entered,THAM_DINH),[{start,end:null}],vn('2026-12-04T10:00:00'));
  assert.equal(paused.isOverdue,false);
  const closed=[{start,end:vn('2026-12-04T10:00:00')}];
  const resumed=stageSlaSummary(stage(entered,THAM_DINH),closed,vn('2026-12-04T10:30:00'));
  assert.equal(resumed.isOverdue,true);assert.equal(resumed.waitingEnterprise,false);
  assert.equal(computeStageClosing(stage(entered,THAM_DINH),[{start,end:null}],vn('2026-12-04T10:00:00')).isDelayed,true);
});
test('a calendar error stays on its own loan and does not throw',()=>{
  const summary=stageSlaSummary(stage(entered,THAM_DINH),[],vn('2027-01-04T10:00:00'));
  assert.match(summary.error,/không bao phủ/);assert.equal(summary.isOverdue,false);assert.equal(summary.netWorkHours,null);
  const unknown=stageSlaSummary(stage(entered,THAM_DINH,{slaCalendarVersion:'KHONG-CO'}),[],due);
  assert.match(unknown.error,/Không tìm thấy phiên bản lịch/);
});
test('a stage whose deadline falls outside the calendar still reports its hours',()=>{
  const summary=stageSlaSummary(stage(vn('2026-12-28T08:00:00'),TIEP_NHAN),[],vn('2026-12-28T10:00:00'));
  assert.equal(summary.netWorkHours,2);assert.equal(summary.dueAt,null);assert.match(summary.error,/không bao phủ/);assert.equal(summary.isOverdue,false);
});
test('a legacy stage keeps its 24/7 hours and has no working-day deadline',()=>{
  const legacy=stage(vn('2026-11-16T08:00:00'),24,{slaPolicy:null,slaCalendarVersion:null});
  const summary=stageSlaSummary(legacy,[],vn('2026-11-17T09:00:00'));
  assert.equal(summary.netWorkHours,25);assert.equal(summary.isOverdue,true);assert.equal(summary.dueAt,null);
});

const activationDb=activation=>({slaPolicyActivation:{findFirst:async()=>activation}});
test('opening a stage outside the calendar is refused with a clear message',async()=>{
  const db=activationDb({policyCode:'PA1',calendarVersion:calendar.version,activatedAt:vn('2026-11-05T17:00:00')});
  assert.deepEqual(await resolveStageSla(db,vn('2026-12-31T16:00:00')),{slaPolicy:'PA1',slaCalendarVersion:calendar.version});
  await assert.rejects(resolveStageSla(db,vn('2027-01-04T08:00:00')),e=>e instanceof BadRequestException&&/không bao phủ ngày 2027-01-04/.test(e.message));
});

test('Admin cannot change Hoàn tất through the API, not even its name',async()=>{
  const controller=new AdminController(new AdminService({workflowStage:{update:async()=>{throw new Error('không được ghi');}}}));
  await assert.rejects(controller.updateStage('HOAN_TAT',{stageName:'Hoàn tất',standardSlaHours:40}),BadRequestException);
});
const dtoErrors=async standardSlaHours=>validate(plainToInstance(UpdateSlaDto,{stageName:'Thẩm định',standardSlaHours}));
test('the quota must be a positive multiple of 4 hours',async()=>{
  for(const ok of [4,20,40,112]) assert.equal((await dtoErrors(ok)).length,0,String(ok));
  for(const bad of [0,-4,2,6,10,112.5]) assert.ok((await dtoErrors(bad)).length>0,String(bad));
});

function supplementDb(loan,history) {
  const state={created:[],pauses:[],stageUpdates:[]};
  const tx={
    $queryRaw:async()=>[],
    loanApplication:{findUnique:async()=>loan,update:async({data})=>Object.assign(loan,data)},
    supplementRequest:{
      findMany:async()=>[],
      findUnique:async()=>state.created[0]&&{...state.created[0],application:loan},
      create:async({data})=>{const row={id:`s${state.created.length+1}`,...data};state.created.push(row);return row;},
      update:async({data})=>({...state.created[0],...data}),
    },
    applicationStageHistory:{findFirst:async()=>history,update:async({data})=>{state.stageUpdates.push(data);Object.assign(history,data);return history;}},
    applicationStagePause:{
      findFirst:async()=>state.pauses.find(p=>p.endedAt===null)??null,
      create:async({data})=>{state.pauses.push({...data,endedAt:null});},
      updateMany:async({data})=>{const open=state.pauses.filter(p=>p.endedAt===null);for(const p of open)Object.assign(p,data);return{count:open.length};},
    },
  };
  const prisma=withCoordination({$transaction:async fn=>fn(withCoordination(tx)),supplementRequest:{findUnique:async()=>state.created[0]}});
  return {state,service:new SupplementsService(prisma,{predictForApplication:async()=>{}})};
}
const counterLoan=()=>({id:'loan1',applicationCode:'SME-1',assignedTo:'cbtd',currentStage:'TIEP_NHAN',currentStatus:'CHECKED',completedAt:null});
const counterHistory=()=>({id:'h1',applicationId:'loan1',enteredAt:vn('2026-11-16T08:00:00'),exitedAt:null,pausedAt:null,pausedDurationHours:0,slaStandardHours:TIEP_NHAN,slaPolicy:'PA1',slaCalendarVersion:calendar.version});

test('a second supplement request is refused while the first is still open',async()=>{
  const {state,service}=supplementDb(counterLoan(),counterHistory());
  await service.createSupplementRequest('loan1',{requestContent:'BCTC 2025'},'cbtd','CBTD',vn('2026-11-17T09:00:00'));
  await assert.rejects(service.createSupplementRequest('loan1',{requestContent:'Sao kê'},'cbtd','CBTD',vn('2026-11-17T10:00:00')),e=>e.getStatus()===400&&/chờ bổ sung/.test(e.message));
  assert.equal(state.created.length,1);assert.equal(state.pauses.length,1);
});
test('counter channel: the clock restarts when the officer records that everything was received',async()=>{
  const {state,service}=supplementDb(counterLoan(),counterHistory());
  await service.createSupplementRequest('loan1',{requestContent:'BCTC 2025'},'cbtd','CBTD',vn('2026-11-17T09:00:00'));
  assert.equal(state.pauses[0].endedAt,null);
  const received=vn('2026-11-19T09:00:00');
  await service.resolveSupplementRequest('s1',{},'cbtd','CBTD',received);
  assert.equal(state.pauses[0].endedAt,received);
});

test('transferring a loan never touches the stage clock',async()=>{
  const loan={id:'loan1',assignedTo:'old',assignmentVersion:1,currentStage:'TIEP_NHAN',completedAt:null,company:{},assignedUser:null};
  const tx=withCoordination({
    $queryRaw:async()=>[],
    loanApplication:{findUnique:async()=>loan,update:async({data})=>({...loan,...data,assignmentVersion:2})},
    applicationAssignment:{findUnique:async()=>null,create:async({data})=>data},
    user:{findUnique:async()=>({id:'new',isActive:true,roles:[{role:{code:'CBTD'}}]})},
    assignmentChangeRequest:{updateMany:async()=>({count:0}),findMany:async()=>[]},
    internalNotification:{create:async()=>({}),createMany:async()=>({count:1})},
    get applicationStageHistory(){throw new Error('điều chuyển không được đọc hoặc ghi lịch sử công đoạn');},
    get applicationStagePause(){throw new Error('điều chuyển không được đọc hoặc ghi khoảng dừng');},
  });
  const result=await transferLoan(tx,'loan1',{newOfficerId:'new',reason:'Cán bộ nghỉ phép dài ngày',expectedAssignmentVersion:1,clientRequestId:'11111111-1111-4111-8111-111111111111'},'manager');
  assert.equal(result.assignmentRecord.toUserId,'new');
});

test('asking to clarify the report keeps the clock running and stays in Thẩm định',async()=>{
  const report={id:'r1',applicationId:'loan1',status:'SUBMITTED',revision:3};
  const updates=[];
  const tx={
    $queryRaw:async()=>[],
    loanApplication:{findUnique:async()=>({id:'loan1',businessPolicyVersion:BRANCH_POLICY,currentStage:'THAM_DINH',assignedTo:'cbtd',intakeOfficerId:'cbtd',completedAt:null})},
    assignmentChangeRequest:{findFirst:async()=>null,findMany:async()=>[]},
    appraisalReport:{findUnique:async()=>report,update:async({data})=>{updates.push(data);return report;}},
    appraisalReportEvent:{findUnique:async()=>null,findFirst:async()=>null,create:async({data})=>data},
    internalNotification:{create:async()=>({})},
    get applicationStageHistory(){throw new Error('làm rõ không được đọc hoặc ghi lịch sử công đoạn');},
    get applicationStagePause(){throw new Error('làm rõ không được tạm dừng SLA');},
  };
  let transitions=0;
  const service=new AppraisalService({$transaction:async fn=>fn(tx),appraisalReport:{findUnique:async()=>report}},{transitionStage:async()=>{transitions++;}},{predictForApplication:async()=>{}});
  await service.mutate('loan1','CLARIFICATION_REQUESTED',{expectedRevision:3,clientRequestId:'22222222-2222-4222-8222-222222222222',message:'Làm rõ nguồn trả nợ'},{id:'tq',activeRole:'THAM_QUYEN'});
  assert.equal(transitions,0);assert.equal(updates[0].status,'CLARIFICATION_REQUIRED');
});

function listDb(loans) {
  let reads=0;
  const prisma={
    loanApplication:{findMany:async()=>{reads++;return loans;}},
    applicationStageHistory:{findMany:async()=>[]},
    applicationStagePause:{findMany:async()=>{throw new Error('danh sách không được truy vấn khoảng dừng từng hồ sơ');}},
  };
  return {prisma,reads:()=>reads};
}
const listLoan=(id,histories)=>({id,company:{},companySnapshot:null,delayPredictions:[],stageHistories:histories,supplementRequests:[]});
test('the list computes each overdue label from one query and tolerates missing history',async()=>{
  const open={...stage(vn('2026-01-05T08:00:00'),8),exitedAt:null,pauses:[]};
  const pausedOpen={...stage(vn('2026-01-05T08:00:00'),8),exitedAt:null,pauses:[{startedAt:vn('2026-01-05T09:00:00'),endedAt:null}]};
  const {prisma,reads}=listDb([listLoan('late',[open]),listLoan('paused',[pausedOpen]),listLoan('none',[]),listLoan('done',[{...open,exitedAt:new Date()}])]);
  const rows=await new LoanApplicationsService(prisma).findAll({id:'m',roles:['QUAN_LY'],activeRole:'QUAN_LY'},{});
  assert.equal(reads(),1);
  const byId=Object.fromEntries(rows.map(row=>[row.id,row.slaSummary]));
  assert.equal(byId.paused.waitingEnterprise,true);assert.equal(byId.paused.isOverdue,false);
  assert.equal(byId.none,null);assert.equal(byId.done,null);
  assert.equal(typeof byId.late.isOverdue,'boolean');
});
