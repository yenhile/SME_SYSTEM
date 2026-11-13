const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {allowedCoordinationReasons,AWAITING_DECISION_MESSAGE}=require('../dist/modules/assignments/coordination-scope');
const {AssignmentChangeRequestsService}=require('../dist/modules/assignments/assignment-change-requests.service');
const {digest,reportEvidence}=require('../dist/modules/appraisal/appraisal.logic');

const POLICY='SME_BRANCH_20261031_V1';
const ALL=['WORKLOAD','UNAVAILABLE','ASSIGNMENT_MISMATCH','CONFLICT_OF_INTEREST','OTHER'];
const base={id:'loan',currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',completedAt:null,assignedTo:'cbtd',intakeOfficerId:'cbtd',businessPolicyVersion:POLICY,
  companyId:'c',companySnapshot:{companyName:'Công ty A'},proposedAmount:'1',officialAmount:'1',loanPurpose:'p',loanType:'THAU_CHI',loanTermMonths:12,supplementRequests:[],coordinationRequests:[]};
function db(loan){return{
  $queryRaw:async()=>[],company:{findUnique:async()=>({id:'c',companyName:'Công ty A'})},document:{findMany:async()=>[]},supplementRequest:{findMany:async()=>[]},
  loanApplication:{findUnique:async()=>loan},
};}
async function freshHash(){return digest(await reportEvidence(db(base),base));}
const report=(status,hash)=>({status,versions:[{evidenceHash:hash}]});

test('while the report waits for the approver only a conflict of interest can be raised',async()=>{
  const loan={...base,appraisalReport:report('SUBMITTED',await freshHash())};
  const scope=await allowedCoordinationReasons(db(loan),'loan');
  assert.deepEqual(scope.reasonCodes,['CONFLICT_OF_INTEREST']);
  assert.equal(scope.restriction,AWAITING_DECISION_MESSAGE);
});
test('legacy loans without a report also wait for the approver',async()=>{
  const scope=await allowedCoordinationReasons(db({...base,businessPolicyVersion:null,appraisalReport:null}),'loan');
  assert.deepEqual(scope.reasonCodes,['CONFLICT_OF_INTEREST']);
});
test('every reason stays open while the officer still has work or the enterprise is supplementing',async()=>{
  const hash=await freshHash();
  const cases=[
    {...base,appraisalReport:report('CLARIFICATION_REQUIRED',hash)},
    {...base,appraisalReport:report('SUBMITTED','stale')},
    {...base,appraisalReport:report('DRAFT',hash)},
    {...base,appraisalReport:report('SUBMITTED',hash),supplementRequests:[{id:'s'}]},
    {...base,currentStage:'TIEP_NHAN',currentStatus:'SUPPLEMENT_REQUIRED',appraisalReport:null},
    {...base,currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',appraisalReport:null},
  ];
  for(const loan of cases){const scope=await allowedCoordinationReasons(db(loan),'loan');assert.deepEqual(scope.reasonCodes,ALL,JSON.stringify(loan.appraisalReport)+loan.currentStage);assert.equal(scope.restriction,null);}
});
test('creating a workload request on a loan waiting for the decision is refused before anything is written',async()=>{
  const loan={...base,applicationCode:'SME-1',assignmentVersion:0,company:{taxCode:'t'},appraisalReport:report('SUBMITTED',await freshHash())};
  let created=false;
  const tx={...db(loan),assignmentChangeRequest:{findUnique:async()=>null,findFirst:async()=>null,create:async()=>{created=true;return{};}},user:{findMany:async()=>[]},internalNotification:{createMany:async()=>{}}};
  const service=new AssignmentChangeRequestsService({$transaction:async fn=>fn(tx)},{});
  const body={subjectType:'LOAN',subjectId:'loan',expectedAssignmentVersion:0,clientRequestId:'11111111-1111-4111-8111-111111111111',reasonCode:'WORKLOAD',reason:'Quá tải'};
  await assert.rejects(service.create(body,{id:'cbtd',activeRole:'CBTD',roles:['CBTD']}),error=>error.getStatus()===409&&error.message===AWAITING_DECISION_MESSAGE);
  assert.equal(created,false);
});
