const {assignmentFixture}=require('./assignment-fixtures.cjs');
/* Owns a random portal_v2_it_* schema. No public seed, migration or reset. */
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const bcrypt=require('bcryptjs');
const {startIsolated}=require('./check-portal-v2-intake.cjs');
const {runChecks}=require('./check-portal-intake-cycle.cjs');
async function runRolloutChecks(h){
  h.app.useLogger({log(){},warn(){},debug(){},verbose(){},error(e){const message=String(e?.stack??e?.message??e).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[REDACTED_DB_URL]');console.error(message.slice(0,1800));}});
  const migration=await require('./check-branch-migration.cjs').checkBranchMigration(h);
  const previous=await runChecks(h),{db,base}=h,f=h.browserFixture;let checks=0;
  const check=(v,m)=>{assert.ok(v,m);checks++;};
  async function call(endpoint,actor,body,method=body===undefined?'GET':'POST'){
    body=await assignmentFixture(db,endpoint,body);
    const r=await fetch(base+endpoint,{method,headers:{Authorization:`Bearer ${actor.token}`,...(actor.role?{'X-Active-Role':actor.role}:{}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    return {status:r.status,data:await r.json().catch(()=>null)};
  }
  const expect=(r,status,m)=>{check([].concat(status).includes(r.status),`${m}: ${r.status} ${JSON.stringify(r.data?.message)}`);return r.data;};
  const officer={token:f.officerToken,role:'CBTD'},manager={token:f.managerToken,role:'QUAN_LY'},portal={token:f.portalToken};
  const roles={};for(const code of ['THAM_QUYEN','ADMIN'])roles[code]=await db.role.create({data:{code,name:code}});
  const actors={};for(const code of ['THAM_QUYEN','ADMIN']){
    const username=`rollout_${code.toLowerCase()}`;
    const user=await db.user.create({data:{username,email:`${username}@example.test`,fullName:username,passwordHash:await bcrypt.hash(f.password,4),roles:{create:{roleId:roles[code].id}}}});
    const login=expect(await call('/auth/login',{token:''},{username,password:f.password}),201,'review actor login');actors[code]={token:login.accessToken,role:code,user};
  }
  await db.userRole.create({data:{userId:f.officerId,roleId:roles.THAM_QUYEN.id}});
  const approver=actors.THAM_QUYEN,admin=actors.ADMIN;
  const otherLogin=expect(await call('/auth/login',{token:''},{username:f.otherUsername,password:f.password}),201,'other officer login');
  const other={token:otherLogin.accessToken,role:'CBTD'};const otherUser=await db.user.findUnique({where:{username:f.otherUsername}});
  const id=previous.loanId,path=`/appraisals/${id}`;
  expect(await call('/portal-intakes/form-config',approver),200,'approver can read document catalog');
  expect(await call('/portal-intakes',approver),403,'approver cannot enter intake queue');
  expect(await call(path,portal),401,'enterprise cannot read report');
  expect(await call(`/workflow/${id}/transition`,officer,{targetStage:'THAM_DINH',targetStatus:'PENDING_APPRAISAL'}),400,'cannot bypass report');
  expect(await call(`/loan-applications/${id}/set-amount`,officer,{officialAmount:100000000},'PUT'),200,'set official amount');
  expect(await call(`/loan-applications/${id}/check-documents`,officer,{isComplete:true},'PUT'),200,'confirm documents');
  const {REPORT_FIELDS}=require('../dist/modules/appraisal/appraisal.logic');
  const content=Object.fromEntries(REPORT_FIELDS.map(k=>[k,k==='proposedInterestRate'?'8':`Synthetic evidence and assessment: ${k}`]));
  const mutate=(r,extra={})=>({expectedRevision:r?.revision??0,clientRequestId:randomUUID(),...extra});
  expect(await call(`${path}/draft`,other,mutate(null,{content}),'PUT'),403,'foreign officer report blocked');
  let report=expect(await call(`${path}/draft`,officer,mutate(null,{content}),'PUT'),200,'save draft');
  expect(await call(`${path}/draft`,approver,mutate(report,{content}),'PUT'),403,'approver cannot write report');
  const submitBody=mutate(report);
  report=expect(await call(`${path}/submit`,officer,submitBody),201,'submit and transition');
  report=expect(await call(`${path}/submit`,officer,submitBody),201,'submit retry');
  check(report.versions.length===1,'one version after repeated submit');
  let loan=await db.loanApplication.findUnique({where:{id}});check(loan.currentStage==='THAM_DINH','report submission changes stage');
  const v1=report.versions[0].id;
  expect(await call(`${path}/draft`,officer,mutate(report,{content}),'PUT'),409,'submitted report locked');
  const historiesBefore=await db.applicationStageHistory.count({where:{applicationId:id}});
  report=expect(await call(`${path}/clarify`,approver,mutate(report,{message:'Explain repayment evidence.'})),201,'clarify internally');
  check(await db.applicationStageHistory.count({where:{applicationId:id}})===historiesBefore,'clarification does not reset stage history');
  check(await db.supplementRequest.count({where:{applicationId:id}})===0,'clarification is not enterprise supplement');
  const open=await db.applicationStageHistory.findFirst({where:{applicationId:id,exitedAt:null}});check(open.pausedAt===null,'internal wait does not pause SLA');
  expect(await call(`/workflow/${id}/transition`,approver,{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:100000000,interestRate:8,reportVersionId:v1}),409,'clarification blocks decision');
  expect(await call(`/assignments/${id}/reassign`,manager,{newOfficerId:otherUser.id,reason:'Synthetic handover'}),201,'reassign report author');
  expect(await call(`${path}/draft`,officer,mutate(report,{content}),'PUT'),403,'old officer loses write access');
  report=expect(await call(`${path}/draft`,other,mutate(report,{content:{...content,repaymentSource:'Synthetic clarified source'}}),'PUT'),200,'new assigned officer revises');
  report=expect(await call(`${path}/submit`,other,mutate(report)),201,'resubmit');
  check(report.versions.length===2&&report.versions[1].id===v1,'original version retained');
  expect(await call(`/workflow/${id}/transition`,{token:f.officerToken,role:'THAM_QUYEN'},{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:100000000,interestRate:8,reportVersionId:report.versions[0].id}),403,'historical maker cannot approve after reassignment');
  expect(await call(`/workflow/${id}/transition`,approver,{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:100000000,interestRate:8,reportVersionId:v1}),409,'old version blocked');
  const doc=(await db.document.findMany({where:{applicationId:id}}))[0];
  expect(await call(`/documents/${doc.id}`,approver,undefined,'DELETE'),403,'the authority cannot delete documents');
  const {reportEvidence,digest:reportDigest}=require('../dist/modules/appraisal/appraisal.logic');
  const evidenceBeforeMasterChange=reportDigest(await db.$transaction(tx=>reportEvidence(tx,loan)));
  await db.company.update({where:{id:loan.companyId},data:{phone:'0900000001'}}); // Owned fixture: shared master changes must not rewrite the loan profile.
  check(reportDigest(await db.$transaction(tx=>reportEvidence(tx,loan)))===evidenceBeforeMasterChange,'master Company changes preserve captured loan evidence');
  await db.loanApplication.update({where:{id},data:{companySnapshot:{...loan.companySnapshot,phone:'0900000001'}}}); // Owned fixture: simulate drift of the loan's actual evidence.
  expect(await call(`/workflow/${id}/transition`,approver,{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:100000000,interestRate:8,reportVersionId:report.versions[0].id}),409,'source drift blocks approval');
  report=expect(await call(`${path}/clarify`,approver,mutate(report,{message:'Reconcile changed source.'})),201,'request new evidence version');
  report=expect(await call(`${path}/submit`,other,mutate(report)),201,'resubmit against current evidence');
  expect(await call(`/workflow/${id}/transition`,approver,{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:100000000,interestRate:8,reportVersionId:report.versions[0].id}),201,'independent final approval');
  const decided=await db.appraisalReport.findUnique({where:{applicationId:id}});check(decided.status==='DECIDED'&&decided.decidedVersionId===report.versions[0].id,'decision binds exact report version');
  expect(await call(`${path}/draft`,other,mutate(report,{content}),'PUT'),403,'closed report cannot be edited');
  const broad={...h.browserData,taxCode:'7333333333',proposedAmount:10000000001};
  expect(await call('/loan-applications',officer,broad),400,'counter over-limit blocked');
  const exact=expect(await call('/loan-applications',officer,{...broad,proposedAmount:10000000000}),201,'exactly 10 billion accepted');
  check(exact.loan.businessPolicyVersion==='SME_BRANCH_20261031_V1','new counter loan has business policy');
  expect(await call(`/workflow/${exact.loan.id}/transition`,officer,{targetStage:'CAP_TREN',targetStatus:'PENDING_APPRAISAL'}),400,'removed stage code is rejected');
  const savedRollout=process.env.PORTAL_V2_ROLLOUT_ENABLED;process.env.PORTAL_V2_ROLLOUT_ENABLED='true';
  try{
    const config=expect(await call('/portal/requests/form-config',portal),200,'released V2 config');check(config.rolloutEnabled&&config.supportedScopes.includes('SERVICES'),'expanded scope advertised');
    expect(await call('/portal/requests',portal,{formVersion:1,data:{}}),409,'new V1 creation disabled');
    const overLimit=expect(await call('/portal/requests',portal,{formVersion:2,clientRequestId:randomUUID(),data:{...h.browserData,proposedAmount:10000000001}}),201,'over-limit draft can be retained');
    expect(await call(`/portal/requests/${overLimit.id}/submit`,portal,{expectedRevision:overLimit.revision,documentIds:[]}),400,'direct Portal submit cannot bypass branch limit');
    check((await db.portalRequest.findUnique({where:{id:overLimit.id}})).status==='DRAFT','over-limit draft is not a credit rejection');
    for(const [index,scope] of ['TRADING','SERVICES'].entries()){
      const data={...h.browserData,taxCode:`722222222${index}`,companyName:`Synthetic ${scope}`,industry:scope==='TRADING'?'Thương mại':'Dịch vụ',businessScope:scope,...(scope==='SERVICES'?{serviceProofMode:'ACCEPTANCE_INVOICE'}:{})};
      let r=expect(await call('/portal/requests',portal,{formVersion:2,clientRequestId:randomUUID(),data}),201,'create expanded request');
      const {getPolicyForScope}=require('../dist/modules/portal/portal.approved-policy');
      const policy=getPolicyForScope(scope);const requirements=policy.requirements.filter(i=>i.stage==='SUBMIT'&&(!i.condition||i.condition.field==='serviceProofMode'&&i.condition.equals===data.serviceProofMode));
      for(const group of ['A','B','C','D']){
        const items=requirements.filter(i=>i.group===group);const coverage=group==='B'?[{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:data.revenuePeriod,components:['BALANCE_SHEET','INCOME_STATEMENT','CASH_FLOW_STATEMENT','NOTES']}]:items.map(i=>({documentTypeCode:i.documentTypeCode}));
        const form=new FormData();form.append('file',new Blob([h.browserPdf],{type:'application/pdf'}),`${scope}-${group}.pdf`);form.append('documentGroup',group);form.append('coverage',JSON.stringify(coverage));form.append('clientUploadId',randomUUID());form.append('expectedRevision',String(r.revision));
        r=expect(await call(`/portal/requests/${r.id}/documents`,portal,form),201,'upload expanded evidence');
      }
      const finance=r.documents.find(d=>d.documentGroup==='B');r=expect(await call(`/portal/requests/${r.id}`,portal,{expectedRevision:r.revision,data:{...r.data,annualRevenueBasis:{documentId:finance.id,fullYearCompleted:true}}},'PUT'),200,'bind annual source');
      const assessment=expect(await call(`/portal/requests/${r.id}/checklist`,portal),200,'expanded checklist');check(assessment.approvedIntakeAssessment.dataReady,'expanded request data-ready');
      r=expect(await call(`/portal/requests/${r.id}/submit`,portal,{expectedRevision:r.revision,documentIds:r.documents.map(d=>d.id)}),201,'submit expanded request');
      expect(await call(`/portal-intakes/${r.id}/assign`,manager,{officerId:f.officerId,expectedAssignedTo:null,expectedRevision:r.revision}),201,'assign expanded request');
      r=expect(await call(`/portal-intakes/${r.id}`,officer),200,'read assigned expanded request');
      let cycle=expect(await call(`/portal-intakes/${r.id}/intake-cycle`,officer),200,'expanded review checklist');
      const correctionItem=cycle.checklist.find(i=>i.group==='C');
      for(const item of cycle.checklist)r=expect(await call(`/portal-intakes/${r.id}/review`,officer,{expectedRevision:r.revision,clientRequestId:randomUUID(),submissionId:cycle.currentSubmissionId,itemId:item.id,decision:item.id===correctionItem.id?'NEEDS_CORRECTION':'ACCEPTED',...(item.id===correctionItem.id?{message:'Clarify scoped evidence.'}:{})}),201,'review expanded item');
      r=expect(await call(`/portal-intakes/${r.id}/return-correction`,officer,{expectedRevision:r.revision,clientRequestId:randomUUID(),submissionId:cycle.currentSubmissionId}),201,'return expanded request');
      r=expect(await call(`/portal/requests/${r.id}`,portal),200,'read returned expanded request');
      const c=r.documents.find(d=>d.documentGroup==='C'),replacement=new FormData();replacement.append('file',new Blob([h.browserReplacement],{type:'application/pdf'}),'corrected-scope.pdf');replacement.append('documentGroup','C');replacement.append('coverage',JSON.stringify(c.coverage));replacement.append('clientUploadId',randomUUID());replacement.append('expectedRevision',String(r.revision));
      r=expect(await call(`/portal/requests/${r.id}/documents/${c.id}/replace`,portal,replacement),201,'replace scope-specific evidence');
      r=expect(await call(`/portal/requests/${r.id}/submit`,portal,{expectedRevision:r.revision,documentIds:r.documents.map(d=>d.id)}),201,'resubmit expanded request');
      cycle=expect(await call(`/portal-intakes/${r.id}/intake-cycle`,officer),200,'read expanded resubmission');
      check(cycle.submissions.length===2&&cycle.checklist.filter(i=>i.group==='A').every(i=>i.review),'expanded resubmission preserves unaffected reviews');
      for(const item of cycle.checklist.filter(i=>!i.review))r=expect(await call(`/portal-intakes/${r.id}/review`,officer,{expectedRevision:r.revision,clientRequestId:randomUUID(),submissionId:cycle.currentSubmissionId,itemId:item.id,decision:'ACCEPTED'}),201,'review corrected scoped evidence');
      const accepted=expect(await call(`/portal-intakes/${r.id}/accept`,officer,{expectedRevision:r.revision,submissionId:cycle.currentSubmissionId}),201,'accept expanded request');
      check(!!accepted.loanId,'expanded request becomes Loan');
      h.expandedFixtures??=[];h.expandedFixtures.push({id:r.id,reference:r.reference,scope,loanId:accepted.loanId});
    }
    // A pending intake must prevent disabling its officer, including before Loan creation.
    let draft=expect(await call('/portal/requests',portal,{formVersion:2,clientRequestId:randomUUID(),data:{...h.browserData,taxCode:'7111111111'}}),201,'draft for account transition');
    await db.portalRequest.update({where:{id:draft.id},data:{status:'ASSIGNED',assignedTo:otherUser.id}});
    expect(await call(`/users/${otherUser.id}`,admin,{isActive:false},'PUT'),400,'cannot lock officer with work');
    const cbtdRole=await db.role.findUnique({where:{code:'CBTD'}});
    const raceUser=await db.user.create({data:{username:'rollout_race_officer',email:'race@example.test',fullName:'Synthetic race officer',passwordHash:await bcrypt.hash(f.password,4),roles:{create:{roleId:cbtdRole.id}}}});
    const raceRequest=await db.portalRequest.create({data:{accountId:h.browserFixture.portalEmail?(await db.portalAccount.findUnique({where:{email:f.portalEmail}})).id:null,reference:'SYNTHETIC-RACE-'+randomUUID(),status:'SUBMITTED',data:{}}});
    const concurrent=await Promise.all([
      call(`/users/${raceUser.id}`,admin,{isActive:false},'PUT'),
      call(`/portal-intakes/${raceRequest.id}/assign`,manager,{officerId:raceUser.id,expectedAssignedTo:null}),
    ]);
    const raceState=await db.user.findUnique({where:{id:raceUser.id}}),requestState=await db.portalRequest.findUnique({where:{id:raceRequest.id}});
    check(!(concurrent[0].status===200&&concurrent[1].status===201),'account disable and assignment cannot both win');
    check(requestState.assignedTo===null||raceState.isActive,'no intake assigned to an inactive account after race');
  }finally{savedRollout===undefined?delete process.env.PORTAL_V2_ROLLOUT_ENABLED:process.env.PORTAL_V2_ROLLOUT_ENABLED=savedRollout;}
  const legacy=await db.loanApplication.create({data:{applicationCode:'SYNTHETIC-LEGACY-'+randomUUID(),companyId:loan.companyId,loanPurpose:'Legacy fixture',loanType:'VAY_VON_LUU_DONG',proposedAmount:20000000000,loanTermMonths:12,assignedTo:f.officerId,currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL'}});
  expect(await call('/workflow/'+legacy.id+'/transition',approver,{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:20000000000,interestRate:8}),400,'legacy over-limit cannot be approved at the branch');
  expect(await call('/workflow/'+legacy.id+'/transition',approver,{targetStage:'HOAN_TAT',targetStatus:'REJECTED',rejectionReasonCode:'TC02',rejectionNote:'Legacy over-limit fixture'}),201,'legacy decision does not require fabricated report');
  const raceLoan=expect(await call('/loan-applications',officer,{...h.browserData,taxCode:'7000000001',proposedAmount:100000000}),201,'create decision race fixture');
  const racePath=`/appraisals/${raceLoan.loan.id}`;
  const proof=new FormData();proof.append('file',new Blob([h.browserPdf],{type:'application/pdf'}),'decision-race.pdf');proof.append('documentType','PHAP_LY');
  expect(await call(`/documents/${raceLoan.loan.id}`,officer,proof),201,'race fixture evidence');
  expect(await call(`/loan-applications/${raceLoan.loan.id}/set-amount`,officer,{officialAmount:100000000},'PUT'),200,'race official amount');
  expect(await call(`/loan-applications/${raceLoan.loan.id}/check-documents`,officer,{isComplete:true},'PUT'),200,'race documents checked');
  let raceReport=expect(await call(`${racePath}/draft`,officer,mutate(null,{content}),'PUT'),200,'race report draft');
  raceReport=expect(await call(`${racePath}/submit`,officer,mutate(raceReport)),201,'race report submitted');
  const outcomes=await Promise.all([
    call(`${racePath}/clarify`,approver,mutate(raceReport,{message:'Synthetic concurrent clarification'})),
    call(`/workflow/${raceLoan.loan.id}/transition`,approver,{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:100000000,interestRate:8,reportVersionId:raceReport.versions[0].id}),
  ]);
  check(outcomes.filter(r=>r.status===201).length===1,'approval and clarification cannot both win');
  const finalRace=await db.appraisalReport.findUnique({where:{applicationId:raceLoan.loan.id}});
  check(outcomes[1].status===201?finalRace.status==='DECIDED':finalRace.status==='CLARIFICATION_REQUIRED','report state agrees with winning transaction');
  if(outcomes[1].status!==201) {
    const revised=expect(await call(`/appraisals/${raceLoan.loan.id}/submit`,officer,mutate(finalRace)),201,'clarified race report resubmitted');
    raceReport=revised;
  } else {
    const rejectedLoan=expect(await call('/loan-applications',officer,{...h.browserData,taxCode:'7000000001',proposedAmount:100000000}),201,'create rejection fixture');
    raceLoan.loan=rejectedLoan.loan;
    const form=new FormData();form.append('file',new Blob([h.browserPdf],{type:'application/pdf'}),'rejection.pdf');form.append('documentType','PHAP_LY');
    expect(await call(`/documents/${raceLoan.loan.id}`,officer,form),201,'rejection evidence');
    expect(await call(`/loan-applications/${raceLoan.loan.id}/set-amount`,officer,{officialAmount:100000000},'PUT'),200,'rejection official amount');
    expect(await call(`/loan-applications/${raceLoan.loan.id}/check-documents`,officer,{isComplete:true},'PUT'),200,'rejection document confirmation');
    raceReport=expect(await call(`/appraisals/${raceLoan.loan.id}/draft`,officer,mutate(null,{content:{...content,recommendation:'Decline: synthetic repayment source insufficient',proposedConditions:''}}),'PUT'),200,'rejection assessment without lending conditions');
    raceReport=expect(await call(`/appraisals/${raceLoan.loan.id}/submit`,officer,mutate(raceReport)),201,'submit rejection assessment');
  }
  const rejection={targetStage:'HOAN_TAT',targetStatus:'REJECTED',reportVersionId:raceReport.versions[0].id};
  expect(await call(`/workflow/${raceLoan.loan.id}/transition`,approver,rejection),400,'rejection requires a reason');
  check((await db.appraisalReport.findUnique({where:{applicationId:raceLoan.loan.id}})).status==='SUBMITTED','invalid rejection rolls back report decision');
  expect(await call(`/workflow/${raceLoan.loan.id}/transition`,approver,{...rejection,rejectionReasonCode:'TC02',rejectionNote:'Synthetic insufficient repayment evidence'}),201,'reject without approved amount or interest');
  check((await db.loanApplication.findUnique({where:{id:raceLoan.loan.id}})).currentStatus==='REJECTED','rejection persisted');
  h.rolloutFixture={...f,approverUsername:approver.user.username,adminUsername:admin.user.username,loanId:exact.loan.id,content};
  return {pass:true,checks,portalRegressionChecks:previous.checks,migration,schema:h.schema};
}
async function main(){let h;try{h=await startIsolated({approvedIntake:true,uploadRoot:require('node:path').resolve(__dirname,'../../.codex_tmp/rollout-uploads-'+randomUUID())});const r=await runRolloutChecks(h);console.log(JSON.stringify(r));}finally{if(h)console.log(JSON.stringify({cleanup:await h.close()}));}}
if(require.main===module)main().catch(e=>{console.error('SME_ROLLOUT_FAILED:',e.message);process.exitCode=1;});
module.exports={runRolloutChecks};
