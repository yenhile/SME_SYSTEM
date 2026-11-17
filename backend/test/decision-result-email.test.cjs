const {withCoordination}=require('./helpers/coordination-fixture.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {WorkflowService}=require('../dist/modules/workflow/workflow.service');
const {PortalMailer}=require('../dist/modules/portal/portal.mailer');

const settle=()=>new Promise(resolve=>setImmediate(resolve));
const tq={id:'tq',activeRole:'THAM_QUYEN'};
const approve={targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:4e9,interestRate:8.5};
const reject={targetStage:'HOAN_TAT',targetStatus:'REJECTED',rejectionReasonCode:'TC02',rejectionNote:'Dòng tiền nội bộ không đủ'};

function harness({loanOver={},portal={reference:'DN-24',account:{email:'dn@example.test'}},mailer}={}) {
  const sent=[];const lookups=[];
  const loan={id:'loan1',applicationCode:'SME-7',currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',assignedTo:'cbtd',completedAt:null,businessPolicyVersion:null,proposedAmount:5e9,officialAmount:5e9,...loanOver};
  const tx={
    $queryRaw:async()=>[],
    loanApplication:{findUnique:async()=>loan,update:async({data})=>Object.assign(loan,data)},
    workflowStage:{findUnique:async({where})=>({id:where.stageCode,standardSlaHours:40})},
    applicationStageHistory:{findFirst:async()=>null,update:async()=>({}),create:async()=>({})},
    applicationStagePause:{findMany:async()=>[]},
    slaPolicyActivation:{findFirst:async()=>null},
    internalNotification:{createMany:async({data})=>({count:data.length})},
    assignmentChangeRequest:{findFirst:async()=>null,findMany:async()=>[],updateMany:async()=>({count:0})},
  };
  const prisma=withCoordination({
    $transaction:async fn=>fn(withCoordination(tx)),
    portalRequest:{findUnique:async args=>{lookups.push(args);return portal;}},
  });
  const stub=mailer??{sendDecisionResult:async(...args)=>{sent.push(args);}};
  return {sent,lookups,tx,service:new WorkflowService(prisma,{predictForApplication:async()=>{}},stub)};
}

test('approval emails the enterprise the result without amount or rate',async()=>{
  const h=harness();
  await h.service.transitionStage('loan1',approve,tq);await settle();await settle();
  assert.deepEqual(h.sent,[['dn@example.test','DN-24','SME-7','APPROVED',null]]);
  assert.equal(h.lookups[0].where.loanId,'loan1');
});

test('rejection emails only the public reason, never the internal note',async()=>{
  const h=harness();
  await h.service.transitionStage('loan1',reject,tq);await settle();await settle();
  assert.deepEqual(h.sent,[['dn@example.test','DN-24','SME-7','REJECTED','Năng lực tài chính không đảm bảo']]);
  assert.doesNotMatch(JSON.stringify(h.sent),/Dòng tiền nội bộ/);
});

test('a loan that did not come from the portal sends no email',async()=>{
  const h=harness({portal:null});
  await h.service.transitionStage('loan1',approve,tq);await settle();await settle();
  assert.equal(h.sent.length,0);
});

test('moving to Thẩm định sends no result email, also inside a caller transaction',async()=>{
  const h=harness({loanOver:{currentStage:'TIEP_NHAN',currentStatus:'CHECKED',isDocumentComplete:true}});
  await h.service.transitionStage('loan1',{targetStage:'THAM_DINH',targetStatus:'PENDING_APPRAISAL'},{id:'cbtd',activeRole:'CBTD'});
  const h2=harness({loanOver:{currentStage:'TIEP_NHAN',currentStatus:'CHECKED',isDocumentComplete:true}});
  await h2.service.transitionStage('loan1',{targetStage:'THAM_DINH',targetStatus:'PENDING_APPRAISAL'},{id:'cbtd',activeRole:'CBTD'},new Date(),withCoordination(h2.tx));
  await settle();await settle();
  assert.equal(h.sent.length+h2.sent.length,0);assert.equal(h.lookups.length+h2.lookups.length,0);
});

test('a mail failure never undoes the decision',async()=>{
  const h=harness({mailer:{sendDecisionResult:async()=>{throw new Error('Brevo down');}}});
  const result=await h.service.transitionStage('loan1',approve,tq);await settle();await settle();
  assert.equal(result.currentStatus,'APPROVED');
});

test('the decision still works without a mailer',async()=>{
  const h=harness();h.service.mailer=undefined;
  assert.equal((await h.service.transitionStage('loan1',reject,tq)).currentStatus,'REJECTED');
});

test('result email matches the portal wording and escapes values',async()=>{
  const mailer=new PortalMailer();const mails=[];mailer.deliver=async m=>{mails.push(m);};
  await mailer.sendDecisionResult('dn@example.test','DN-24','SME-7','APPROVED',null);
  await mailer.sendDecisionResult('dn@example.test','DN-<9>','SME-8','REJECTED','Năng lực tài chính không đảm bảo');
  const [ok,no]=mails;
  assert.match(ok.subject,/SME-7 đã được phê duyệt/);
  assert.match(ok.text,/Hồ sơ đã được phê duyệt\. Ngân hàng sẽ liên hệ về các bước tiếp theo\./);
  assert.match(ok.text,/DN-24/);assert.doesNotMatch(ok.text,/VNĐ|lãi suất|%/i);assert.doesNotMatch(ok.html,/VNĐ|lãi suất/i);
  assert.match(no.subject,/SME-8 không được chấp thuận/);
  assert.match(no.text,/Lý do: Năng lực tài chính không đảm bảo/);
  assert.match(no.html,/DN-&lt;9&gt;/);
});
