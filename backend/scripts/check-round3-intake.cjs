/* Real HTTP/PostgreSQL, owned portal_v2_it_* namespace only; never public migration/seed. */
const assert=require('node:assert/strict'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const bcrypt=require('bcryptjs');
const {PDFDocument}=require('pdf-lib');
const {assignmentFixture}=require('./assignment-fixtures.cjs');
const {startIsolated}=require('./check-portal-v2-intake.cjs');
async function runRound3Checks(h){
 const {db,base}=h;let checks=0;
 const check=(v,m)=>{assert.ok(v,m);checks++;};
 async function call(endpoint,actor,body,method=body===undefined?'GET':'POST'){
  body=await assignmentFixture(db,endpoint,body);
  const response=await fetch(base+endpoint,{method,headers:{...(actor?{Authorization:'Bearer '+actor.token,'X-Active-Role':actor.role}:{}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  return {status:response.status,data:await response.json().catch(()=>null)};
 }
 const expect=(r,status,label)=>{check([].concat(status).includes(r.status),`${label}: HTTP ${r.status} ${JSON.stringify(r.data?.message??'')}`);return r.data;};
 const password='Round3Synthetic123!',hash=await bcrypt.hash(password,4),actors={};
 for(const [name,code]of [['officer','CBTD'],['other','CBTD'],['manager','QUAN_LY']]){
  const role=await db.role.upsert({where:{code},update:{},create:{code,name:'Synthetic '+code}});
  const user=await db.user.create({data:{username:'r3_'+name+'_'+randomUUID().slice(0,8),fullName:'Synthetic '+name,email:randomUUID()+'@example.test',passwordHash:hash,roles:{create:{roleId:role.id}}}});
  const login=expect(await call('/auth/login',null,{username:user.username,password}),201,'staff login');actors[name]={user,token:login.accessToken,role:code};
 }
 const account=await db.portalAccount.create({data:{email:randomUUID()+'@example.test',passwordHash:hash,contactName:'Synthetic enterprise',phone:'0900000000',verifiedAt:new Date()}});
 for(const [i,code]of ['TIEP_NHAN','THAM_DINH','HOAN_TAT'].entries())await db.workflowStage.upsert({where:{stageCode:code},update:{},create:{stageCode:code,stageName:code,standardSlaHours:[8,24,4][i],orderIndex:i+1}});
 const login=expect(await call('/portal/auth/login',null,{email:account.email,password}),201,'enterprise login');
 const portal={token:login.accessToken,role:''},officer=actors.officer,manager=actors.manager,other=actors.other;
 process.env.PORTAL_V2_ROLLOUT_ENABLED='true';
 const dataset=require('../../docs/testing/portal-v2-policy/test-data.json');
 const pdf=await PDFDocument.create();pdf.addPage([200,200]).drawText('Synthetic Round 3 evidence');const bytes=Buffer.from(await pdf.save());
 const ip=r=>'/portal-intakes/'+r.id,rp=r=>'/portal/requests/'+r.id;
 const op=r=>({expectedRevision:r.revision,clientRequestId:randomUUID()});
 const cycle=async r=>expect(await call(ip(r)+'/intake-cycle',officer),200,'cycle');
 async function upload(r,document){const form=new FormData();form.append('file',new Blob([bytes],{type:'application/pdf'}),'synthetic.pdf');form.append('documentGroup',document.documentGroup);form.append('coverage',JSON.stringify(document.coverage));form.append('expectedRevision',String(r.revision));form.append('clientUploadId',randomUUID());return expect(await call(rp(r)+'/documents',portal,form),201,'upload');}
 async function createRequest(taxCode){
  let r=expect(await call('/portal/requests',portal,{formVersion:2,clientRequestId:randomUUID(),data:{...dataset.baseline.data,taxCode}}),201,'draft');
  let finance;
  for(const d of dataset.baseline.documents){r=await upload(r,d);if(d.id==='finance')finance=r.documents.find(x=>x.documentGroup==='B');}
  r=expect(await call(rp(r),portal,{expectedRevision:r.revision,data:{...r.data,annualRevenueBasis:{documentId:finance.id,fullYearCompleted:true}}},'PUT'),200,'annual source');
  r=expect(await call(rp(r)+'/submit',portal,{expectedRevision:r.revision,documentIds:r.documents.map(d=>d.id)}),201,'submit');
  r=expect(await call(ip(r)+'/assign',manager,{officerId:officer.user.id,expectedAssignedTo:null,expectedRevision:r.revision}),201,'assign');
  return reviewAll(r);
 }
 async function reviewAll(r){const v=await cycle(r);for(const item of v.checklist.filter(i=>!i.review||i.review.decision!=='ACCEPTED'))r=expect(await call(ip(r)+'/review',officer,{...op(r),submissionId:v.currentSubmissionId,itemId:item.id,decision:'ACCEPTED'}),201,'review');return r;}
 let r=await createRequest('7999999901'),v=await cycle(r);
 const pendingBody={...op(r),message:'Please correct declared financial data'};
 r=expect(await call(rp(r)+'/request-correction',portal,pendingBody),201,'request correction');
 const noticeCount=await db.internalNotification.count({where:{userId:officer.user.id,requestId:r.id,title:'Doanh nghiệp đề nghị chỉnh sửa'}});
 expect(await call(rp(r)+'/request-correction',portal,pendingBody),201,'correction retry');
 check(await db.internalNotification.count({where:{userId:officer.user.id,requestId:r.id,title:'Doanh nghiệp đề nghị chỉnh sửa'}})===noticeCount,'no duplicate notification');
 check(noticeCount===1,'assigned officer notified');check(!(await cycle(r)).canAccept,'pending request blocks receive view');
 expect(await call(ip(r)+'/accept',officer,{expectedRevision:r.revision,submissionId:v.currentSubmissionId}),409,'pending request blocks receive API');
 expect(await call(ip(r)+'/correction-decision',other,{...op(r),submissionId:v.currentSubmissionId,decision:'REJECT',reason:'Synthetic'}),404,'other officer denied');
 r=expect(await call(ip(r)+'/correction-decision',officer,{...op(r),submissionId:v.currentSubmissionId,decision:'REJECT',reason:'The original declared data is verified'}),201,'reject with reason');
 check(r.correctionHistory.length===1&&r.status==='ASSIGNED','rejection retains history without unlocking');
 r=expect(await call(rp(r)+'/request-correction',portal,{...op(r),message:'A real change needs return'}),201,'second request after decision');
 r=expect(await call(ip(r)+'/correction-decision',officer,{...op(r),submissionId:v.currentSubmissionId,decision:'APPROVE',reason:'Update annual revenue from real annual source'}),201,'approve data return');
 check(r.status==='RETURNED','data-only return works');
 r=expect(await call(rp(r),portal,{expectedRevision:r.revision,data:{...r.data,annualRevenue:2000000}},'PUT'),200,'working data');
 const before=structuredClone(r);
 r=await upload(r,dataset.baseline.documents[0]);
 const rows=expect(await call('/portal-intakes',officer),200,'staff queue'),row=rows.find(x=>x.id===r.id);
 check(row.data.annualRevenue===0,'staff queue sees published revenue');
 check(row.documents.length===before.documents.length,'staff queue hides not-yet-submitted document');
 check(expect(await call(ip(r),officer),200,'staff detail').data.annualRevenue===0,'staff detail agrees with queue');
 r=expect(await call(rp(r)+'/submit',portal,{expectedRevision:r.revision,documentIds:r.documents.map(d=>d.id)}),201,'resubmit');
 v=await cycle(r);check(v.checklist.every(i=>!i.review),'data return requires checks again');r=await reviewAll(r);v=await cycle(r);
 const fields=['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address'];
 const company=await db.company.create({data:{...Object.fromEntries(fields.map(k=>[k,r.data[k]])),companyName:'Old Company Profile',annualRevenue:1000}});
 const old=await db.loanApplication.create({data:{applicationCode:'R3-OLD-'+randomUUID(),companyId:company.id,loanPurpose:'Old',loanType:'VAY_VON_LUU_DONG',proposedAmount:100000000,loanTermMonths:12,assignedTo:other.user.id}});
 let match=expect(await call(ip(r)+'/company-match',officer),200,'company match');
 const reconBody={...op(r),submissionId:v.currentSubmissionId,companyHash:match.companyHash,reason:'INTERNAL_RECON: verify against submitted legal and annual source'};
 r=expect(await call(ip(r)+'/company-reconciliation',officer,reconBody),201,'request reconciliation');
 expect(await call(ip(r)+'/company-reconciliation',officer,reconBody),201,'reconciliation retry');
 let issue=(await cycle(r)).issues.find(i=>i.kind==='COMPANY_RECONCILIATION'&&i.status==='OPEN');
 check(!!issue,'pending reconciliation retained');
 expect(await call(ip(r)+'/issues',manager,{...op(r),issueId:issue.id,resolution:'Cannot bypass scoped operation'}),409,'generic issue closure cannot bypass reconciliation');
 expect(await call(ip(r)+'/accept',officer,{expectedRevision:r.revision,submissionId:v.currentSubmissionId,confirmExistingCompany:true,confirmExistingCompanyFinancials:true}),409,'open reconciliation blocks receive');
 const managerRole=await db.role.findUnique({where:{code:'QUAN_LY'}});await db.userRole.create({data:{userId:officer.user.id,roleId:managerRole.id}});
 expect(await call(ip(r)+'/company-reconciliation/resolve',{...officer,role:'QUAN_LY'},{...op(r),issueId:issue.id,decision:'APPROVE',reason:'Self decision forbidden'}),403,'self reconciliation denied');
 await db.userRole.deleteMany({where:{userId:officer.user.id,roleId:managerRole.id}}); // UI fixture stays single-role; role picker belongs to R6.
 expect(await call('/companies',officer,Object.fromEntries(fields.map(k=>[k,r.data[k]]))),403,'Portal assignment does not grant generic Company update');
 // A different authorized Company writer changes data between match and decision.
 expect(await call('/companies',other,{...Object.fromEntries(fields.map(k=>[k,company[k]])),annualRevenue:1000,charterCapital:Number(company.charterCapital),phone:'0900000001'}),201,'authorized separate Company write');
 expect(await call(ip(r)+'/company-reconciliation/resolve',manager,{...op(r),issueId:issue.id,decision:'APPROVE',reason:'Stale approval forbidden'}),409,'stale Company blocks reconciliation');
 r=expect(await call(ip(r)+'/company-reconciliation/resolve',manager,{...op(r),issueId:issue.id,decision:'REJECT',reason:'Company changed; reassess current values'}),201,'close stale proposal with reason');
 match=expect(await call(ip(r)+'/company-match',officer),200,'new Company match');
 r=expect(await call(ip(r)+'/company-reconciliation',officer,{...op(r),submissionId:v.currentSubmissionId,companyHash:match.companyHash,reason:'Verify current Company and submitted evidence'}),201,'fresh reconciliation');
 issue=(await cycle(r)).issues.find(i=>i.kind==='COMPANY_RECONCILIATION'&&i.status==='OPEN');
 const {reportEvidence}=require('../dist/modules/appraisal/appraisal.logic');
 const evidenceBefore=JSON.stringify(await db.$transaction(tx=>reportEvidence(tx,old)));
 const approve={...op(r),issueId:issue.id,decision:'APPROVE',reason:'Verified against submitted source; approve scoped Company update'};
 const race=await Promise.all([call(ip(r)+'/company-reconciliation/resolve',manager,approve),call(ip(r)+'/company-reconciliation/resolve',manager,{...approve,clientRequestId:randomUUID()})]);
 check(race.filter(x=>x.status===201).length===1&&race.filter(x=>x.status===409).length===1,'concurrent decisions commit once');r=race.find(x=>x.status===201).data;
 expect(await call(ip(r)+'/company-reconciliation/resolve',manager,approve),201,'committed decision retry');
 const frozen=await db.loanApplication.findUnique({where:{id:old.id}});
 check(frozen.companySnapshot.annualRevenue==='1000'&&frozen.companySnapshot.companyName==='Old Company Profile','old loan profile preserved');
 check(frozen.updatedAt.getTime()===old.updatedAt.getTime(),'freezing does not rewrite old loan timestamp');
 const oldView=expect(await call('/loan-applications/'+old.id,other),200,'old loan detail');check(oldView.company.companyName==='Old Company Profile'&&Number(oldView.company.annualRevenue)===1000,'old API reads captured profile');
 const oldList=expect(await call('/loan-applications?keyword=old%20company%20profile',other),200,'search old profile');check(oldList.some(x=>x.id===old.id),'old profile searchable without case sensitivity');
 const evidence=await db.$transaction(tx=>reportEvidence(tx,frozen));check(evidence.company.companyName==='Old Company Profile','appraisal retains old Company evidence');check(JSON.stringify(evidence)===evidenceBefore,'Company reconciliation leaves complete old appraisal evidence unchanged');
 const publicCycle=expect(await call(rp(r)+'/intake-cycle',portal),200,'public reconciliation view');check(!JSON.stringify(publicCycle).includes('INTERNAL_RECON')&&!publicCycle.issues.some(i=>i.context),'private reconciliation evidence hidden');
 r=expect(await call(ip(r),officer),200,'latest request');v=await cycle(r);
 const receiveBody={expectedRevision:r.revision,submissionId:v.currentSubmissionId,confirmExistingCompany:true,confirmExistingCompanyFinancials:true};
 const receiveRace=await Promise.all([call(ip(r)+'/accept',officer,receiveBody),call(rp(r)+'/request-correction',portal,{...op(r),message:'Concurrent correction request'})]);
 check(receiveRace.filter(x=>x.status===201).length===1&&receiveRace.filter(x=>x.status===409).length===1,'correction request and receive serialize safely');
 let accepted;
 if(receiveRace[0].status===201){accepted=receiveRace[0].data;check((await db.portalRequest.findUnique({where:{id:r.id}})).correctionRequest?.status!=='PENDING','no pending correction created after receive');}
 else {r=receiveRace[1].data;r=expect(await call(ip(r)+'/correction-decision',officer,{...op(r),submissionId:v.currentSubmissionId,decision:'REJECT',reason:'Verified submitted data remains correct'}),201,'resolve correction that won race');accepted=expect(await call(ip(r)+'/accept',officer,{...receiveBody,expectedRevision:r.revision}),201,'receive after race resolution');}
 const loan=await db.loanApplication.findUnique({where:{id:accepted.loanId}});check(loan.currentStatus==='RECEIVED'&&loan.companySnapshot.annualRevenue==='2000000','new Loan captures reconciled data');
 check(await db.loanApplication.count({where:{portalRequest:{id:r.id}}})===1,'exactly one Loan');
 // A second request supports UI checks without modifying accepted history.
 const ui=await createRequest('7999999902');await db.company.create({data:{...Object.fromEntries(fields.map(k=>[k,ui.data[k]])),annualRevenue:1234}});
 const uiPending=expect(await call(rp(ui)+'/request-correction',portal,{...op(ui),message:'Please review my requested correction'}),201,'prepare pending UI case');
 h.round3Fixture={requestId:ui.id,reference:ui.reference,revision:uiPending.revision,portalEmail:account.email,password,officerUsername:officer.user.username,managerUsername:manager.user.username,officerId:officer.user.id,managerId:manager.user.id,officerToken:officer.token,managerToken:manager.token};
 h.round3Actions={call,expect,reviewAll,op,portal,officer,manager};
 return {pass:true,checks,schema:h.schema,ownedNamespace:true};
}
module.exports={runRound3Checks};
if(require.main===module)(async()=>{let h;try{h=await startIsolated({approvedIntake:true,round3Migration:true,uploadRoot:path.resolve(__dirname,'../../.codex_tmp/rollout-uploads-'+randomUUID())});console.log(JSON.stringify(await runRound3Checks(h)));}catch(e){console.error('ROUND3_FAILED:',e.message);process.exitCode=1;}finally{if(h)console.log(JSON.stringify({cleanup:await h.close()}));}})();
