/* Real approved-policy API/PostgreSQL checks in an owned portal_v2_it_* schema.
 * No public seed/reset. startIsolated verifies target and owns cleanup of test uploads.
 */
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const bcrypt=require('bcryptjs');
const {startIsolated}=require('./check-portal-v2-intake.cjs');
const password='IntakeCycleSynthetic123!';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

async function runChecks(h){
  const {db,base}=h;let checks=0;
  const check=(v,m)=>{assert.ok(v,m);checks++;};
  async function call(endpoint,actor={},body,method=body===undefined?'GET':'POST',binary=false){
    const headers={};if(actor.token)headers.Authorization=`Bearer ${actor.token}`;if(actor.role)headers['X-Active-Role']=actor.role;
    if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
    const response=await fetch(base+endpoint,{method,headers,body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    return {status:response.status,data:binary?Buffer.from(await response.arrayBuffer()):await response.json().catch(()=>null)};
  }
  const expect=(r,status,label)=>{check([].concat(status).includes(r.status),`${label}: HTTP ${r.status} ${JSON.stringify(r.data?.message??'')}`);return r.data;};
  const hash=await bcrypt.hash(password,4),actors={};
  for(const code of ['QUAN_LY','CBTD']){
    const role=await db.role.create({data:{code,name:`Synthetic ${code}`}});
    for(const suffix of code==='CBTD'?['CBTD','OTHER']:['QUAN_LY']){
      const user=await db.user.create({data:{username:`cycle_${suffix.toLowerCase()}`,email:`${suffix.toLowerCase()}@example.test`,fullName:`Synthetic ${suffix}`,passwordHash:hash,roles:{create:{roleId:role.id}}}});
      const login=expect(await call('/auth/login',{}, {username:user.username,password}),201,'staff login');actors[suffix]={token:login.accessToken,role:code,user};
    }
  }
  const portals=[];
  for(let i=0;i<2;i++){
    const account=await db.portalAccount.create({data:{email:`cycle${i}@example.test`,passwordHash:hash,contactName:'Synthetic contact',phone:'0900000000',verifiedAt:new Date()}});
    const login=expect(await call('/portal/auth/login',{}, {email:account.email,password}),201,'portal login');portals.push({account,token:login.accessToken});
  }
  for(const [i,code]of ['TIEP_NHAN','THAM_DINH','CAP_TREN','HOAN_TAT'].entries())await db.workflowStage.create({data:{stageCode:code,stageName:code,standardSlaHours:[8,24,16,4][i],orderIndex:i+1}});
  const portal=portals[0],foreign=portals[1],officer=actors.CBTD,other=actors.OTHER,manager=actors.QUAN_LY;
  const year=String(new Date(Date.now()+7*3600000).getUTCFullYear()-1);
  const data={taxCode:'7888888888',companyName:'Synthetic Cycle Manufacturing',industry:'Sản xuất',establishedYear:2020,annualRevenue:0,charterCapital:500000000,representativeName:'Synthetic Representative',phone:'0900000000',address:'Synthetic address',loanPurpose:'Materials',loanType:'VAY_VON_LUU_DONG',proposedAmount:100000000,loanTermMonths:12,businessScope:'MANUFACTURING',revenuePeriod:year,representative:{mode:'LEGAL_REPRESENTATIVE'},submissionDeclaration:{accepted:true,version:'portal-enterprise-submission-v1'},hasExistingDebt:false,collateral:{mode:'NONE_REQUESTED'}};
  const {PDFDocument}=require('pdf-lib');
  async function pdf(text){const d=await PDFDocument.create(),p=d.addPage([200,200]);p.drawText(text);return Buffer.from(await d.save());}
  const bytes=await pdf('Synthetic first submission'),replacementBytes=await pdf('Synthetic corrected statement');
  const rp=r=>`/portal/requests/${r.id}`,ip=r=>`/portal-intakes/${r.id}`;
  const get=async r=>expect(await call(rp(r),portal),200,'refresh');
  const cycle=async(r,actor=officer)=>expect(await call(`${actor===portal?rp(r):ip(r)}/intake-cycle`,actor),200,'cycle view');
  const manifest=r=>({expectedRevision:r.revision,documentIds:r.documents.map(d=>d.id)});
  const mutation=(r,extra={})=>({expectedRevision:r.revision,clientRequestId:randomUUID(),...extra});
  async function upload(r,group,coverage,replace,content=bytes){
    const f=new FormData();f.append('documentGroup',group);f.append('coverage',JSON.stringify(coverage));f.append('expectedRevision',String(r.revision));f.append('clientUploadId',randomUUID());f.append('file',new Blob([content],{type:'application/pdf'}),'synthetic-cycle.pdf');
    return expect(await call(`${rp(r)}/documents${replace?`/${replace}/replace`:''}`,portal,f),201,'upload');
  }
  let r=expect(await call('/portal/requests',portal,{formVersion:2,clientRequestId:randomUUID(),data}),201,'create');
  expect(await call(`${rp(r)}/submit`,portal,manifest(r)),400,'incomplete cannot send');
  const coverage=[['A',['A_BUSINESS_REGISTRATION','A_CHARTER','A_REPRESENTATIVE_AUTHORITY','A_REPRESENTATIVE_ID'].map(documentTypeCode=>({documentTypeCode}))],['B',[{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:year,components:['BALANCE_SHEET','INCOME_STATEMENT','CASH_FLOW_STATEMENT','NOTES']}]],['C',[{documentTypeCode:'C_PRODUCTION_PLAN'},{documentTypeCode:'C_PURCHASE_ORDER'}]],['D',[{documentTypeCode:'D_LOAN_REQUEST'},{documentTypeCode:'D_CAPITAL_PLAN'}]]];
  for(const [g,c]of coverage)r=await upload(r,g,c);
  const finance=r.documents.find(d=>d.documentGroup==='B');
  r=expect(await call(rp(r),portal,{expectedRevision:r.revision,data:{...r.data,annualRevenueBasis:{documentId:finance.id,fullYearCompleted:true}}},'PUT'),200,'annual source');
  h.browserDraft={...r};
  const firstManifest=manifest(r),sent=await Promise.all([call(`${rp(r)}/submit`,portal,firstManifest),call(`${rp(r)}/submit`,portal,firstManifest)]);
  r=expect(sent[0],201,'send');expect(sent[1],201,'retry send');
  check(await db.portalSubmission.count({where:{requestId:r.id}})===1,'one published submission');check(r.loanId===null,'send never starts Loan');
  const original=digest((await db.portalSubmission.findFirst({where:{requestId:r.id}})).snapshot);
  expect(await call(`${rp(r)}/intake-cycle`,foreign),404,'foreign owner denied');
  expect(await call(`${ip(r)}/intake-cycle`,other),404,'unassigned officer denied');
  expect(await call(`${ip(r)}/review`,manager,mutation(r,{submissionId:'x',itemId:'x',decision:'ACCEPTED'})),403,'manager cannot review');
  r=expect(await call(`${ip(r)}/assign`,manager,{officerId:officer.user.id,expectedAssignedTo:null,expectedRevision:r.revision}),201,'assign');
  const raceView=await cycle(r);
  const race=await Promise.all([
    call(`${ip(r)}/review`,officer,mutation(r,{submissionId:raceView.currentSubmissionId,itemId:'legal.registration',decision:'ACCEPTED'})),
    call(`${ip(r)}/assign`,manager,{officerId:other.user.id,expectedAssignedTo:officer.user.id,expectedRevision:r.revision,note:'Concurrent assignment fixture'}),
  ]);
  check(race.filter(x=>x.status===201).length===1,'review/reassignment race commits exactly one operation');
  check(race.some(x=>[404,409].includes(x.status)),'stale concurrent actor/version rejected');
  r=await get(r);
  if(r.assignedTo!==officer.user.id)r=expect(await call(`${ip(r)}/assign`,manager,{officerId:officer.user.id,expectedAssignedTo:r.assignedTo,expectedRevision:r.revision,note:'Restore synthetic assignment'}),201,'restore after concurrent assignment');
  let v=await cycle(r);const firstSubmissionId=v.currentSubmissionId;
  expect(await call(`${ip(r)}/accept`,officer,{expectedRevision:r.revision,submissionId:firstSubmissionId}),409,'cannot receive before reviews');
  expect(await call(rp(r),portal,{expectedRevision:r.revision,data:r.data},'PUT'),409,'submitted cannot edit');
  let replay;
  for(const item of v.checklist){const body=mutation(r,{submissionId:v.currentSubmissionId,itemId:item.id,decision:item.id==='finance.INCOME_STATEMENT'?'NEEDS_CORRECTION':'ACCEPTED',...(item.id==='finance.INCOME_STATEMENT'?{message:'Provide correct statement content'}:{})});
    r=expect(await call(`${ip(r)}/review`,officer,body),201,'review');replay=body;
  }
  expect(await call(`${ip(r)}/review`,officer,replay),201,'review replay');
  expect(await call(`${ip(r)}/review`,officer,{...replay,decision:'NEEDS_CORRECTION',message:'different'}),409,'operation key content mismatch');
  const returnBody=mutation(r,{submissionId:firstSubmissionId});
  r=expect(await call(`${ip(r)}/return-correction`,officer,returnBody),201,'return consolidated');
  expect(await call(`${ip(r)}/return-correction`,officer,returnBody),201,'return retry');check(r.status==='RETURNED','returned state');
  check((await cycle(r,portal)).submissions[0].returnItems.length===1,'public correction reasons');
  const status=expect(await call(`${rp(r)}/status`,portal),200,'tracking');check(status.status.code==='RETURNED','tracking returned');
  expect(await call(rp(r),portal,{expectedRevision:r.revision,data:{...r.data,taxCode:'7999999999'}},'PUT'),409,'different enterprise denied');
  const beforeAssign=r.revision;
  r=expect(await call(`${ip(r)}/assign`,manager,{officerId:other.user.id,expectedAssignedTo:officer.user.id,expectedRevision:r.revision,note:'Synthetic reassign'}),201,'reassign while returned');
  check(r.status==='RETURNED'&&r.revision>beforeAssign,'assignment preserves returned state');
  expect(await call(`${ip(r)}/review`,officer,mutation(r,{submissionId:firstSubmissionId,itemId:'legal.registration',decision:'ACCEPTED'})),404,'old officer blocked');
  r=expect(await call(`${ip(r)}/assign`,manager,{officerId:officer.user.id,expectedAssignedTo:other.user.id,expectedRevision:r.revision,note:'Synthetic return assignment'}),201,'assign back');
  r=await upload(r,'B',coverage[1][1],finance.id,replacementBytes);
  const replacement=r.documents.find(d=>d.documentGroup==='B');
  r=expect(await call(rp(r),portal,{expectedRevision:r.revision,data:{...r.data,annualRevenueBasis:{documentId:replacement.id,fullYearCompleted:true}}},'PUT'),200,'updated source');
  const downloadOld=expect(await call(`${ip(r)}/documents/${finance.id}/download`,officer,undefined,'GET',true),200,'old staff evidence download');
  check(downloadOld.equals(bytes),'old bytes retained');
  const draftView=expect(await call(ip(r),officer),200,'staff sees frozen snapshot while editing');check(draftView.data.annualRevenueBasis.documentId===finance.id,'staff never reviews working draft');
  const secondBody=manifest(r),second=await Promise.all([call(`${rp(r)}/submit`,portal,secondBody),call(`${rp(r)}/submit`,portal,secondBody)]);
  r=expect(second[0],201,'resubmit');expect(second[1],201,'retry resubmit');
  v=await cycle(r);check(v.submissions.length===2,'exactly two submissions');check(v.currentSubmissionId!==firstSubmissionId,'new submission identity');
  check(digest((await db.portalSubmission.findUnique({where:{id:firstSubmissionId}})).snapshot)===original,'first published snapshot immutable');
  check(v.checklist.filter(i=>i.group==='B').every(i=>i.review===null),'changed financial evidence rechecked');
  check(v.checklist.filter(i=>i.group==='A').every(i=>i.review?.decision==='ACCEPTED'),'unchanged legal reviews retained');
  expect(await call(`${ip(r)}/accept`,officer,{expectedRevision:r.revision,submissionId:firstSubmissionId}),409,'old submission cannot receive');
  expect(await call(`${ip(r)}/review`,officer,mutation({...r,revision:r.revision-1},{submissionId:v.currentSubmissionId,itemId:'legal.registration',decision:'ACCEPTED'})),409,'stale revision denied');
  for(const item of v.checklist.filter(i=>!i.review))r=expect(await call(`${ip(r)}/review`,officer,mutation(r,{submissionId:v.currentSubmissionId,itemId:item.id,decision:'ACCEPTED'})),201,'review changed evidence');
  r=expect(await call(`${ip(r)}/issues`,manager,mutation(r,{description:'INTERNAL_ONLY_CYCLE',proposal:'Manager coordinates synthetic check',publicMessage:'Bank is reconciling enterprise information'})),201,'manager issue');
  const publicView=await cycle(r,portal);check(!JSON.stringify(publicView).includes('INTERNAL_ONLY_CYCLE'),'internal issue excluded');
  expect(await call(`${ip(r)}/accept`,officer,{expectedRevision:r.revision,submissionId:v.currentSubmissionId}),409,'open issue blocks receive');
  const issue=(await cycle(r)).issues[0];r=expect(await call(`${ip(r)}/issues`,manager,mutation(r,{issueId:issue.id,resolution:'Synthetic check completed'})),201,'resolve issue');
  const fields=['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address'];
  const company=await db.company.create({data:{...Object.fromEntries(fields.map(k=>[k,r.data[k]])),annualRevenue:99}});
  expect(await call(`${ip(r)}/accept`,officer,{expectedRevision:r.revision,submissionId:v.currentSubmissionId,confirmExistingCompany:true,confirmExistingCompanyFinancials:true}),409,'Company financial mismatch blocks approved policy');
  check(Number((await db.company.findUnique({where:{id:company.id}})).annualRevenue)===99,'Company preserved');
  await db.company.update({where:{id:company.id},data:{annualRevenue:0}}); // Fixture-only separate reconciliation, not an application bypass.
  const acceptBody={expectedRevision:r.revision,submissionId:v.currentSubmissionId,confirmExistingCompany:true,confirmExistingCompanyFinancials:true};
  const accepted=await Promise.all([call(`${ip(r)}/accept`,officer,acceptBody),call(`${ip(r)}/accept`,officer,acceptBody)]);
  const a=expect(accepted[0],201,'receive');const b=expect(accepted[1],201,'receive retry');check(a.loanId===b.loanId,'same Loan on receive retry');
  check(await db.loanApplication.count({where:{companyId:company.id}})===1,'one Loan');
  const loan=await db.loanApplication.findUnique({where:{id:a.loanId}});check(loan.currentStage==='TIEP_NHAN'&&loan.currentStatus==='RECEIVED'&&!loan.isDocumentComplete,'receive not CHECKED/appraisal');
  expect(await call(rp(r),portal,{expectedRevision:r.revision,data:r.data},'PUT'),409,'received original locked');
  check(await db.delayPrediction.count({where:{applicationId:loan.id}})===0,'no fabricated ML prediction');
  const portalHistory=await cycle({...r,status:'ACCEPTED'},portal);check(!JSON.stringify(portalHistory).includes('reviewerId'),'public history hides reviewer identity');
  // A separate editable draft is intentionally retained for browser checks in this same owned schema.
  h.browserFixture={portalEmail:portal.account.email,password,managerUsername:manager.user.username,officerUsername:officer.user.username,otherUsername:other.user.username,officerId:officer.user.id,portalToken:portal.token,officerToken:officer.token,managerToken:manager.token};
  h.browserData={...data,taxCode:'7666666666'};
  h.browserCoverage=coverage;h.browserPdf=bytes;h.browserReplacement=replacementBytes;
  return {pass:true,checks,schema:h.schema,loanId:loan.id};
}
async function main(){let h;try{h=await startIsolated({approvedIntake:true});const result=await runChecks(h);console.log(JSON.stringify(result));}finally{if(h)console.log(JSON.stringify({cleanup:await h.close()}));}}
if(require.main===module)main().catch(e=>{console.error('INTAKE_CYCLE_FAILED:',e.message);process.exitCode=1;});
module.exports={runChecks};
