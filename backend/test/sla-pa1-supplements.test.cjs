const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {waitingOn}=require('../dist/modules/supplements/portal-supplement');
const {SupplementRemindersService}=require('../dist/modules/supplements/supplement-reminders.service');
const {WorkflowService}=require('../dist/modules/workflow/workflow.service');
const {openStagePause,closeStagePause}=require('../dist/modules/workflow/sla/sla-policy');

const items=(...status)=>({portalSupplement:{version:1,items:status.map((s,i)=>({id:`i${i}`,status:s}))}});

// C.9.2: bên đang chờ quyết định nhắc/quá hạn có áp dụng hay không.
test('waitingOn: pending or replace-required items mean the enterprise is still waiting',()=>{
  assert.equal(waitingOn(items('PENDING')),'ENTERPRISE');
  assert.equal(waitingOn(items('REPLACE_REQUIRED','ACCEPTED')),'ENTERPRISE');
  assert.equal(waitingOn(items('SUBMITTED','REPLACE_REQUIRED')),'ENTERPRISE');
});
test('waitingOn: everything submitted or accepted means the bank is checking',()=>{
  assert.equal(waitingOn(items('SUBMITTED')),'BANK');
  assert.equal(waitingOn(items('SUBMITTED','ACCEPTED')),'BANK');
  assert.equal(waitingOn(items('ACCEPTED','ACCEPTED')),'BANK');
});
test('waitingOn: legacy free-text requests have no items and always wait for the enterprise',()=>{
  assert.equal(waitingOn({portalSupplement:null}),'ENTERPRISE');
  assert.equal(waitingOn({}),'ENTERPRISE');
  assert.equal(waitingOn({portalSupplement:{version:1,items:[]}}),'ENTERPRISE');
});

const requestedAt=new Date('2026-10-26T03:00:00Z'); // Mon 26/10 10:00 VN
const row=(over={})=>({id:'s1',applicationId:'loan1',requestedAt,deadlineAt:null,reminderSentAt:null,reminderEmailSentAt:null,overdueAt:null,
  application:{id:'loan1',applicationCode:'HS-001',assignedTo:'cbtd',portalRequest:{account:{email:'dn@example.test'}}},...over});
function reminders(rows) {
  const state={notices:[],emails:[],marked:[]};
  const prisma={
    $transaction:async fn=>fn(prisma),
    supplementRequest:{findMany:async()=>rows,updateMany:async({where,data})=>{const r=rows.find(x=>x.id===where.id);const [field]=Object.keys(where).filter(k=>k!=='id');if(!r||r[field]!==null)return{count:0};Object.assign(r,data);state.marked.push(data);return{count:1};}},
    internalNotification:{create:async({data})=>{state.notices.push(data);return data;}},
  };
  const mailer={sendSupplementReminder:async(email,code)=>{state.emails.push({email,code});}};
  return {state,service:new SupplementRemindersService(prisma,mailer)};
}

// C.9.5(4): phản hồi đủ chờ ngân hàng kiểm tra không bị nhắc thiếu hay đánh dấu quá hạn.
test('an enterprise that sent everything is not reminded or marked overdue while the bank checks',async()=>{
  const {state,service}=reminders([row(items('SUBMITTED','SUBMITTED'))]);
  assert.deepEqual(await service.scan(new Date('2026-11-02T04:00:00Z')),{reminded:0,overdue:0}); // sau ngày 5
  assert.deepEqual(await service.scan(new Date('2026-11-05T04:00:00Z')),{reminded:0,overdue:0}); // sau ngày 10
  assert.equal(state.notices.length,0);assert.equal(state.emails.length,0);assert.equal(state.marked.length,0);
});
test('the same request is still reminded and marked overdue while the enterprise is the waiting party',async()=>{
  const {state,service}=reminders([row(items('PENDING'))]);
  assert.deepEqual(await service.scan(new Date('2026-11-02T04:00:00Z')),{reminded:1,overdue:0});
  assert.equal(state.emails.length,1);
  assert.deepEqual(await service.scan(new Date('2026-11-05T04:00:00Z')),{reminded:0,overdue:1});
});
test('an existing late marker is kept (no reset) and the bank-waiting request is skipped',async()=>{
  const late=new Date('2026-11-05T04:00:00Z');
  const rows=[row({...items('SUBMITTED'),overdueAt:late})];
  const {state,service}=reminders(rows);
  assert.deepEqual(await service.scan(new Date('2026-11-06T04:00:00Z')),{reminded:0,overdue:0});
  assert.equal(rows[0].overdueAt.getTime(),late.getTime());assert.equal(state.marked.length,0);
});

// C.9.5(4): quản lý không đóng hồ sơ chỉ vì ngân hàng chưa kiểm tra phản hồi đã gửi đủ.
function closer(supplements) {
  const updates=[];
  const tx={
    $queryRaw:async()=>[],
    loanApplication:{findUnique:async()=>({id:'loan1',currentStage:'TIEP_NHAN',currentStatus:'SUPPLEMENT_REQUIRED',completedAt:null}),update:async({data})=>{updates.push(data);return data;}},
    supplementRequest:{findMany:async()=>supplements,updateMany:async()=>({count:1})},
    workflowStage:{findUnique:async()=>({id:'done',standardSlaHours:4})},
    applicationStageHistory:{findFirst:async()=>({id:'h',enteredAt:requestedAt,pausedAt:null,pausedDurationHours:0,slaStandardHours:4,slaPolicy:null,slaCalendarVersion:null}),update:async()=>({}),create:async()=>({})},
    slaPolicyActivation:{findFirst:async()=>null},
    applicationStagePause:{findMany:async()=>[],updateMany:async()=>({count:0})},
  };
  const service=new WorkflowService({$transaction:async fn=>fn(tx)},{predictForApplication:async()=>{}});
  const close=now=>service.closeOverdueSupplement('loan1',{reason:'Quá hạn'},{id:'m',activeRole:'QUAN_LY'},now);
  close.updates=updates;
  return close;
}
const afterDeadline=new Date('2026-11-06T04:00:00Z');
test('manager cannot close a loan whose enterprise already sent everything, even past the deadline',async()=>{
  const close=closer([{id:'s1',status:'PENDING',requestedAt,deadlineAt:null,...items('SUBMITTED')}]);
  await assert.rejects(close(afterDeadline),e=>e.getStatus()===400&&/chưa quá hạn/.test(e.message));
});
test('manager can still close when the enterprise is the one overdue',async()=>{
  const close=closer([{id:'s1',status:'PENDING',requestedAt,deadlineAt:null,...items('PENDING')}]);
  await close(afterDeadline);
  assert.equal(close.updates.length,1);
  assert.equal(close.updates[0].currentStatus,'CLOSED_TIMEOUT');
});

// Khoảng dừng PA1: mở/đóng lặp an toàn, công đoạn cách cũ không dùng bảng này.
function pauseDb(stage) {
  const state={pauses:[],stageUpdates:[]};
  return {state,db:{
    applicationStageHistory:{findFirst:async()=>stage,update:async({data})=>{state.stageUpdates.push(data);}},
    applicationStagePause:{
      findFirst:async()=>state.pauses.find(p=>p.endedAt===null)??null,
      create:async({data})=>{state.pauses.push({...data,endedAt:null});},
      updateMany:async({data})=>{const open=state.pauses.filter(p=>p.endedAt===null);for(const p of open)Object.assign(p,data);return{count:open.length};},
    },
  }};
}
const t1=new Date('2026-10-27T03:00:00Z'),t2=new Date('2026-10-27T07:00:00Z');
test('opening a pause twice creates one open pause; closing twice closes once',async()=>{
  const {db,state}=pauseDb({id:'h1',slaPolicy:'PA1'});
  assert.equal(await openStagePause(db,'loan1',t1,'WAIT_ENTERPRISE','s1'),true);
  assert.equal(await openStagePause(db,'loan1',t1,'WAIT_ENTERPRISE','s1'),false);
  assert.equal(state.pauses.length,1);assert.equal(state.pauses[0].startedAt,t1);
  assert.equal(await closeStagePause(db,'loan1',t2),true);
  assert.equal(await closeStagePause(db,'loan1',t2),false);
  assert.equal(state.pauses[0].endedAt,t2);
});
test('a legacy stage never gets PA1 pause rows',async()=>{
  const {db,state}=pauseDb({id:'h1',slaPolicy:null});
  assert.equal(await openStagePause(db,'loan1',t1,'WAIT_ENTERPRISE'),false);
  assert.equal(await closeStagePause(db,'loan1',t2),false);
  assert.equal(state.pauses.length,0);
});
