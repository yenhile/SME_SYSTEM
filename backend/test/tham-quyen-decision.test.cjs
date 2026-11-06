const {withCoordination}=require('./helpers/coordination-fixture.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {WorkflowService}=require('../dist/modules/workflow/workflow.service');
const {AppraisalService}=require('../dist/modules/appraisal/appraisal.service');
const {digest,reportEvidence}=require('../dist/modules/appraisal/appraisal.logic');
const {DocumentsController}=require('../dist/modules/documents/documents.controller');
const {DocumentsService}=require('../dist/modules/documents/documents.service');
const {ROLES_KEY}=require('../dist/common/decorators/roles.decorator');
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');

function decisionHarness(loanOver={}) {
  const notices=[];
  const loan={id:'loan1',applicationCode:'SME-7',currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',assignedTo:'cbtd',completedAt:null,businessPolicyVersion:null,proposedAmount:5e9,officialAmount:5e9,...loanOver};
  const tx={
    $queryRaw:async()=>[],
    loanApplication:{findUnique:async()=>loan,update:async({data})=>Object.assign(loan,data)},
    workflowStage:{findUnique:async({where})=>({id:where.stageCode,standardSlaHours:40})},
    applicationStageHistory:{findFirst:async()=>null,update:async()=>({}),create:async()=>({})},
    applicationStagePause:{findMany:async()=>[]},
    slaPolicyActivation:{findFirst:async()=>null},
    internalNotification:{createMany:async({data})=>{notices.push(...data);return{count:data.length};}},
    assignmentChangeRequest:{findFirst:async()=>null,findMany:async()=>[],updateMany:async()=>({count:0})},
  };
  const service=new WorkflowService(withCoordination({$transaction:async fn=>fn(withCoordination(tx))}),{predictForApplication:async()=>{}});
  return {notices,service};
}
const tq={id:'tq',activeRole:'THAM_QUYEN'};

test('approving tells the assigned officer the approved amount and rate',async()=>{
  const {notices,service}=decisionHarness();
  await service.transitionStage('loan1',{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:4e9,interestRate:8.5},tq);
  const notice=notices.find(n=>n.userId==='cbtd');
  assert.ok(notice,'officer gets a notification');
  assert.equal(notice.applicationId,'loan1');
  assert.equal(notice.title,'Hồ sơ đã được phê duyệt');
  assert.match(notice.message,/SME-7/);assert.match(notice.message,/4\.000\.000\.000/);assert.match(notice.message,/8,5%/);
});
test('rejecting tells the assigned officer the reason',async()=>{
  const {notices,service}=decisionHarness();
  await service.transitionStage('loan1',{targetStage:'HOAN_TAT',targetStatus:'REJECTED',rejectionReasonCode:'TC02',rejectionNote:'Dòng tiền không đủ'},tq);
  const notice=notices.find(n=>n.userId==='cbtd');
  assert.ok(notice,'officer gets a notification');
  assert.equal(notice.title,'Hồ sơ bị từ chối');
  assert.match(notice.message,/SME-7/);assert.match(notice.message,/TC02/);assert.match(notice.message,/Dòng tiền không đủ/);
});
test('a loan without an assigned officer can still be decided',async()=>{
  const {notices,service}=decisionHarness({assignedTo:null});
  await service.transitionStage('loan1',{targetStage:'HOAN_TAT',targetStatus:'REJECTED',rejectionReasonCode:'TC02',rejectionNote:'Dòng tiền không đủ'},tq);
  assert.equal(notices.filter(n=>n.title==='Hồ sơ bị từ chối').length,0);
});
test('moving from Tiếp nhận to Thẩm định sends no decision notification',async()=>{
  const {notices,service}=decisionHarness({currentStage:'TIEP_NHAN',currentStatus:'CHECKED',isDocumentComplete:true});
  await service.transitionStage('loan1',{targetStage:'THAM_DINH',targetStatus:'PENDING_APPRAISAL'},{id:'cbtd',activeRole:'CBTD'});
  assert.equal(notices.filter(n=>/phê duyệt|từ chối/.test(n.title)).length,0);
});

function documentHarness(stage) {
  const created=[];
  const loan={id:'loan1',currentStage:stage,currentStatus:stage==='TIEP_NHAN'?'RECEIVED':'PENDING_APPRAISAL',assignedTo:'cbtd',completedAt:null,isDocumentComplete:false};
  const tx=withCoordination({
    $queryRaw:async()=>[],
    loanApplication:{findUnique:async()=>loan,update:async()=>loan},
    document:{create:async({data})=>{created.push(data);return data;}},
    assignmentChangeRequest:{findFirst:async()=>null,findMany:async()=>[]},
  });
  return {created,service:new DocumentsService({$transaction:async fn=>fn(tx)})};
}
const documentInput={documentType:'KHAC',fileName:'x.pdf',fileSize:1,mimeType:'application/pdf',filePath:'k'};
test('the upload endpoint no longer admits the authority role',()=>{
  const roles=Reflect.getMetadata(ROLES_KEY,DocumentsController.prototype.create);
  assert.deepEqual(roles,['CBTD']);
});
test('an account that also holds CBTD cannot upload while acting as the authority',async()=>{
  const {created,service}=documentHarness('THAM_DINH');
  await assert.rejects(service.create('loan1',documentInput,'da-vai','THAM_QUYEN'),e=>e.getStatus()===403);
  assert.equal(created.length,0);
});
test('the assigned officer still uploads at Tiếp nhận',async()=>{
  const {created,service}=documentHarness('TIEP_NHAN');
  await service.create('loan1',documentInput,'cbtd','CBTD');
  assert.equal(created.length,1);
});
test('the delete endpoint no longer admits the authority role',()=>{
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY,DocumentsController.prototype.delete),['CBTD']);
});
function deleteHarness(loan) {
  const removed=[];
  const doc={id:'d1',applicationId:'loan1',filePath:'seed/x.pdf',portalDocumentId:null};
  const tx=withCoordination({
    $queryRaw:async()=>[],
    document:{findUnique:async()=>doc,delete:async({where})=>{removed.push(where.id);return doc;}},
    loanApplication:{findUnique:async()=>loan,update:async()=>loan},
    appraisalReportVersion:{findMany:async()=>[]},
    assignmentChangeRequest:{findFirst:async()=>null,findMany:async()=>[]},
  });
  return {removed,service:new DocumentsService({document:{findUnique:async()=>doc},$transaction:async fn=>fn(tx)})};
}
const appraisalLoan=over=>({id:'loan1',currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',assignedTo:'cbtd',completedAt:null,isDocumentComplete:true,...over});
test('an authority cannot delete a file, also on an old loan without a report',async()=>{
  for(const businessPolicyVersion of ['SME_BRANCH_20261031_V1',null]){
    const {removed,service}=deleteHarness(appraisalLoan({businessPolicyVersion}));
    await assert.rejects(service.delete('d1',{id:'tq',activeRole:'THAM_QUYEN'}),e=>e.getStatus()===403);
    assert.equal(removed.length,0);
  }
});
test('the assigned officer still deletes a file at Tiếp nhận',async()=>{
  const {removed,service}=deleteHarness(appraisalLoan({currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',isDocumentComplete:false,businessPolicyVersion:null}));
  await service.delete('d1',{id:'cbtd',activeRole:'CBTD'});
  assert.deepEqual(removed,['d1']);
});

test('the loan list states each report status from one query, without exposing the report',async()=>{
  let reads=0;
  const row=(id,appraisalReport)=>({id,company:{},companySnapshot:null,delayPredictions:[],stageHistories:[],supplementRequests:[],appraisalReport});
  const prisma={
    loanApplication:{findMany:async({include})=>{reads++;assert.deepEqual(include.appraisalReport,{select:{status:true,versions:{orderBy:{sequence:'desc'},take:1,select:{sequence:true,submittedAt:true}}}});return[row('a',{status:'SUBMITTED',versions:[{sequence:2,submittedAt:new Date('2026-11-05T01:00:00Z')}]}),row('b',null)];}},
    applicationStageHistory:{findMany:async()=>[]},
  };
  const rows=await new LoanApplicationsService(prisma).findAll({id:'tq',roles:['THAM_QUYEN'],activeRole:'THAM_QUYEN'},{});
  assert.equal(reads,1);
  assert.equal(rows[0].reportStatus,'SUBMITTED');assert.equal(rows[1].reportStatus,null);
  assert.deepEqual(rows[0].reportVersion,{sequence:2,submittedAt:new Date('2026-11-05T01:00:00Z')});assert.equal(rows[1].reportVersion,null);
  assert.equal('appraisalReport' in rows[0],false);
});

function viewHarness({status='SUBMITTED',stage='THAM_DINH',completedAt=null}={}) {
  const loan={id:'loan1',companyId:'c1',currentStage:stage,completedAt,assignedTo:'cbtd',intakeOfficerId:'cbtd',proposedAmount:5e9,officialAmount:5e9,loanPurpose:'p',loanType:'t',loanTermMonths:12,companySnapshot:{companyName:'DN'}};
  const state={documents:[],supplements:[]};
  const db={
    $queryRaw:async()=>[],
    company:{findUnique:async()=>({id:'c1',companyName:'DN'})},
    document:{findMany:async()=>state.documents},
    supplementRequest:{findMany:async()=>state.supplements},
    loanApplication:{findUnique:async()=>loan},
    appraisalReportEvent:{findFirst:async()=>null},
    user:{findMany:async({where})=>{state.userQueries=(state.userQueries??0)+1;return [{id:'cbtd',fullName:'Nguyễn Cán Bộ',username:'cbtd'},{id:'noname',fullName:'',username:'nguoi_khac'}].filter(u=>where.id.in.includes(u.id));}},
  };
  return {db,loan,state,status,build:async()=>{
    const evidenceHash=digest(await reportEvidence(db,loan));
    const report={id:'r1',status,versions:[{id:'v2',sequence:2,evidenceHash,submittedBy:'noname'},{id:'v1',sequence:1,evidenceHash,submittedBy:'cbtd'}],events:[]};
    db.appraisalReport={findUnique:async()=>report};
    return new AppraisalService(db,{},{});
  }};
}
test('every submitted version names who submitted it, from one lookup',async()=>{
  const h=viewHarness();const service=await h.build();
  const view=await service.view('loan1',{id:'tq',activeRole:'THAM_QUYEN'});
  assert.deepEqual(view.versions.map(v=>v.submittedByName),['nguoi_khac','Nguyễn Cán Bộ']);
  assert.equal(h.state.userQueries,1);
});
test('the report says evidence is unchanged right after submission',async()=>{
  const h=viewHarness();const service=await h.build();
  assert.equal((await service.view('loan1',{id:'tq',activeRole:'THAM_QUYEN'})).evidenceChanged,false);
});
test('a supplement added after submission marks the evidence as changed',async()=>{
  const h=viewHarness();const service=await h.build();
  h.state.supplements.push({id:'s1',status:'RESOLVED',requestContent:'Sao kê',portalSupplement:null,resolvedAt:new Date('2026-11-05T03:00:00Z')});
  assert.equal((await service.view('loan1',{id:'tq',activeRole:'THAM_QUYEN'})).evidenceChanged,true);
});
test('an unreadable evidence file also counts as changed instead of failing the view',async()=>{
  const h=viewHarness();const service=await h.build();
  h.state.documents.push({id:'d1',documentType:'KHAC',fileName:'x.pdf',fileSize:1,filePath:'../ngoai-thu-muc.pdf'});
  assert.equal((await service.view('loan1',{id:'tq',activeRole:'THAM_QUYEN'})).evidenceChanged,true);
});
test('evidence is only compared while a submitted report waits for a decision',async()=>{
  for(const options of [{status:'CLARIFICATION_REQUIRED'},{status:'DECIDED',stage:'HOAN_TAT',completedAt:new Date()}]){
    const h=viewHarness(options);const service=await h.build();
    h.state.supplements.push({id:'s1',status:'RESOLVED',requestContent:'Sao kê',portalSupplement:null,resolvedAt:null});
    assert.equal((await service.view('loan1',{id:'tq',activeRole:'THAM_QUYEN'})).evidenceChanged,false,JSON.stringify(options));
  }
});
