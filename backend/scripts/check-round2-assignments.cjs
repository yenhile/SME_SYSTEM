/* Owned localhost schema/uploads only. Raw new API bodies, no fixture adapter. */
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),path=require('node:path');
const {startIsolated}=require('./check-portal-v2-intake.cjs'),{runRolloutChecks}=require('./check-sme-rollout.cjs');
async function runCoordinationChecks(h){
  const {db,base}=h,f=h.rolloutFixture;let checks=0,n=0;
  const check=(v,m)=>{assert.ok(v,m);checks++;};
  async function call(endpoint,actor={},body,method=body===undefined?'GET':'POST'){
    const r=await fetch(base+endpoint,{method,headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(actor.token?{Authorization:`Bearer ${actor.token}`,...(actor.role?{'X-Active-Role':actor.role}:{})}:{})},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    return{status:r.status,data:await r.json().catch(()=>null)};
  }
  const expect=(r,status,label)=>{check([].concat(status).includes(r.status),`${label}: ${r.status} ${JSON.stringify(r.data?.message??'')}`);return r.data;};
  async function login(username,role){const user=await db.user.findUniqueOrThrow({where:{username}}),r=expect(await call('/auth/login',{}, {username,password:f.password}),201,'synthetic actor login');return{user,token:r.accessToken,role};}
  const a=await login(f.officerUsername,'CBTD'),b=await login(f.otherUsername,'CBTD'),manager=await login(f.managerUsername,'QUAN_LY'),admin=await login(f.adminUsername,'ADMIN'),approver=await login(f.approverUsername,'THAM_QUYEN');
  const endpoint='/assignment-change-requests';
  expect(await call(endpoint+'/capabilities',a),200,'coordination capability exists');
  async function loan(){return expect(await call('/loan-applications',a,{...h.browserData,taxCode:String(6500000000+(++n)),companyName:`Synthetic coordination ${n}`,proposedAmount:100000000}),201,'synthetic loan').loan;}
  const createBody=(l,reasonCode='WORKLOAD')=>({subjectType:'LOAN',subjectId:l.id,expectedAssignmentVersion:l.assignmentVersion,clientRequestId:randomUUID(),reasonCode,reason:'Synthetic documented coordination request'});
  const resolution=(r,extra={})=>({expectedRequestVersion:r.requestVersion,expectedAssignmentVersion:r.currentAssignmentVersion,clientRequestId:randomUUID(),decisionReason:'Synthetic manager assessment',...extra});
  let l=await loan(),body=createBody(l),r=expect(await call(endpoint,a,body),201,'officer requests coordination');
  check(r.status==='PENDING'&&r.managerRecipientCount>=1,'pending with manager notification recipients');
  check((await db.loanApplication.findUniqueOrThrow({where:{id:l.id}})).assignedTo===a.user.id,'request leaves owner unchanged');
  const replay=expect(await call(endpoint,a,body),201,'create retry');check(replay.id===r.id,'create retry same receipt');
  expect(await call(endpoint,a,{...body,clientRequestId:randomUUID()}),409,'one pending per case');
  expect(await call(endpoint,b,{...body,clientRequestId:randomUUID()}),403,'foreign officer cannot request');
  expect(await call(endpoint,admin,body),403,'admin cannot coordinate');
  const decision=resolution(r,{newOfficerId:b.user.id});
  const approved=expect(await call(`${endpoint}/${r.id}/approve`,manager,decision),201,'manager approves handover');
  check(approved.status==='APPROVED'&&approved.currentOwnerId===b.user.id,'approval changes owner');
  const count=await db.applicationAssignment.count({where:{applicationId:l.id}});
  const again=expect(await call(`${endpoint}/${r.id}/approve`,manager,decision),201,'approval retry');check(again.replayed&&await db.applicationAssignment.count({where:{applicationId:l.id}})===count,'retry no second history');
  expect(await call(`/loan-applications/${l.id}`,a),403,'old officer loses case access');
  const receipt=expect(await call(`${endpoint}/${r.id}`,a),200,'old officer retains minimal receipt');
  check(!JSON.stringify(receipt).includes('annualRevenue')&&!JSON.stringify(receipt).includes('passwordHash')&&!receipt.currentCaseLinkAllowed,'receipt has no current financial data/access');
  l=await loan();r=expect(await call(endpoint,a,createBody(l)),201,'second request');
  expect(await call(`${endpoint}/${r.id}/reject`,manager,resolution(r)),400,'reject requires ability confirmation');
  const rejected=expect(await call(`${endpoint}/${r.id}/reject`,manager,resolution(r,{confirmCanContinue:true})),201,'reasoned rejection');check(rejected.status==='REJECTED'&&rejected.currentOwnerId===a.user.id,'rejection retains owner');
  r=expect(await call(endpoint,a,createBody(l)),201,'new request after rejection');
  const cancel=resolution(r);check(expect(await call(`${endpoint}/${r.id}/cancel`,a,cancel),201,'sender cancels').status==='CANCELLED','cancelled status');
  r=expect(await call(endpoint,a,createBody(l)),201,'request before direct handover');
  expect(await call(`/assignments/${l.id}/reassign`,manager,{newOfficerId:b.user.id,reason:'Synthetic direct handover',expectedAssignmentVersion:0,clientRequestId:randomUUID()}),201,'direct transfer');
  check(expect(await call(`${endpoint}/${r.id}`,a),200,'obsolete receipt').status==='OBSOLETE','direct transfer closes old request');
  expect(await call(`${endpoint}/${r.id}/approve`,manager,resolution(r,{newOfficerId:b.user.id})),409,'obsolete request cannot approve');
  // Concurrent creation and resolution are serialized by the same parent lock.
  l=await loan();const simultaneous=await Promise.all([call(endpoint,a,createBody(l)),call(endpoint,a,createBody(l))]);
  check(simultaneous.filter(x=>x.status===201).length===1&&simultaneous.filter(x=>x.status===409).length===1,'one concurrent pending request');
  r=simultaneous.find(x=>x.status===201).data;
  const resolutions=await Promise.all([call(`${endpoint}/${r.id}/approve`,manager,resolution(r,{newOfficerId:b.user.id})),call(`${endpoint}/${r.id}/reject`,manager,resolution(r,{confirmCanContinue:true}))]);
  check(resolutions.filter(x=>x.status===201).length===1&&resolutions.filter(x=>x.status===409).length===1,'one concurrent decision');
  // COI must block all staff write paths, not just the visible form.
  l=await loan();const docForm=new FormData();docForm.append('file',new Blob([h.browserPdf],{type:'application/pdf'}),'coordination-source.pdf');docForm.append('documentType','PHAP_LY');
  const uploaded=expect(await call(`/documents/${l.id}`,a,docForm),201,'evidence before COI');
  const document=await db.document.findFirstOrThrow({where:{applicationId:l.id}});
  const company=await db.company.findUniqueOrThrow({where:{id:l.companyId}});
  const supplement=expect(await call(`/supplements/${l.id}`,a,{requestContent:'Synthetic pending evidence'}),201,'supplement before COI');
  const supplementRow=await db.supplementRequest.findFirstOrThrow({where:{applicationId:l.id}});
  r=expect(await call(endpoint,a,createBody(l,'CONFLICT_OF_INTEREST')),201,'COI request');
  const pendingSla=await db.applicationStageHistory.findMany({where:{applicationId:l.id}});
  for(const [url,command,method,who]of [
    [`/loan-applications/${l.id}/check-documents`,{isComplete:true},'PUT',a],
    [`/loan-applications/${l.id}/set-amount`,{officialAmount:100000000},'PUT',a],
    [`/documents/${document.id}`,undefined,'DELETE',a],
    [`/supplements/${l.id}`,{requestContent:'Synthetic additional request'},'POST',a],
    [`/supplements/${supplementRow.id}/resolve`,{},'PUT',a],
    [`/appraisals/${l.id}/draft`,{expectedRevision:0,clientRequestId:randomUUID(),content:{}},'PUT',a],
    [`/appraisals/${l.id}/submit`,{expectedRevision:0,clientRequestId:randomUUID()},'POST',a],
    [`/workflow/${l.id}/transition`,{targetStage:'THAM_DINH',targetStatus:'PENDING_APPRAISAL'},'POST',a],
    ['/companies',{...h.browserData,taxCode:company.taxCode,companyName:'Synthetic forbidden change'},'POST',a],
    ['/loan-applications',{...h.browserData,taxCode:company.taxCode,proposedAmount:100000000},'POST',a],
  ])expect(await call(url,who,command,method),403,'COI blocks '+url);
  const blockedUpload=new FormData();blockedUpload.append('file',new Blob([h.browserPdf],{type:'application/pdf'}),'blocked.pdf');blockedUpload.append('documentType','PHAP_LY');expect(await call(`/documents/${l.id}`,a,blockedUpload),403,'COI blocks upload');
  expect(await call(`${endpoint}/${r.id}/cancel`,a,resolution(r)),403,'COI cannot self-cancel');
  expect(await call(`${endpoint}/${r.id}/reject`,manager,resolution(r,{confirmCanContinue:true})),400,'COI rejection needs explicit finding');
  const managerRole=await db.role.findUniqueOrThrow({where:{code:'QUAN_LY'}});await db.userRole.create({data:{userId:a.user.id,roleId:managerRole.id}});
  expect(await call(`${endpoint}/${r.id}/approve`,{...a,role:'QUAN_LY'},resolution(r,{newOfficerId:b.user.id})),403,'switching role cannot self-approve');
  await db.userRole.deleteMany({where:{userId:a.user.id,roleId:managerRole.id}});
  expect(await call(`/appraisals/${l.id}/clarify`,{...a,role:'THAM_QUYEN'},{expectedRevision:0,clientRequestId:randomUUID(),message:'Synthetic role bypass'}),403,'sender cannot bypass COI with authority role');
  expect(await call(`/workflow/${l.id}/transition`,approver,{targetStage:'HOAN_TAT',targetStatus:'REJECTED',rejectionReasonCode:'TC02',rejectionNote:'Synthetic'}),403,'COI blocks independent final decision');
  check(JSON.stringify(await db.applicationStageHistory.findMany({where:{applicationId:l.id}}))===JSON.stringify(pendingSla),'COI does not pause/reset SLA');
  check((await db.company.findUniqueOrThrow({where:{id:company.id}})).companyName===company.companyName,'COI preserves Company');
  expect(await call(`${endpoint}/${r.id}/reject`,manager,resolution(r,{confirmCanContinue:true,resolutionCode:'NO_CONFLICT_CONFIRMED',decisionReason:'Synthetic evidence confirms no conflict'})),201,'documented no-conflict finding');
  expect(await call(`/supplements/${supplementRow.id}/resolve`,a,{} ,'PUT'),200,'staff writes resume after resolving COI');
  // Portal COI uses the same guard, including review/return/accept and linked Company paths.
  const account=await db.portalAccount.findFirstOrThrow();
  let p=await db.portalRequest.create({data:{reference:'COI-'+randomUUID(),accountId:account.id,status:'ASSIGNED',assignedTo:a.user.id,formVersion:2,checklistVersion:'SME_MANUFACTURING_WORKING_CAPITAL_V1',data:{...h.browserData,taxCode:String(6400000000+(++n))}}});
  const pc={subjectType:'PORTAL',subjectId:p.id,expectedAssignmentVersion:0,clientRequestId:randomUUID(),reasonCode:'CONFLICT_OF_INTEREST',reason:'Synthetic Portal conflict'};
  let pr=expect(await call(endpoint,a,pc),201,'Portal COI request');
  expect(await call(`${endpoint}/${pr.id}/approve`,manager,resolution(pr,{newOfficerId:a.user.id})),400,'Portal approval must change the current officer');
  for(const [suffix,command]of [['review',{submissionId:'synthetic',itemId:'synthetic',decision:'ACCEPTED'}],['return-correction',{submissionId:'synthetic'}]])expect(await call(`/portal-intakes/${p.id}/${suffix}`,a,{expectedRevision:0,clientRequestId:randomUUID(),...command}),403,'Portal COI blocks '+suffix);
  expect(await call(`/portal-intakes/${p.id}/accept`,a,{expectedRevision:0,submissionId:'synthetic'}),403,'Portal COI blocks accept');
  expect(await call(`${endpoint}/${pr.id}/approve`,manager,resolution(pr,{newOfficerId:b.user.id})),201,'Portal COI handover resolves request');
  check((await db.portalRequest.findUniqueOrThrow({where:{id:p.id}})).assignedTo===b.user.id,'Portal new owner after COI handover');
  // Workload is identical on both APIs, includes pending intakes and only latest risk.
  const workLoan=await loan();await db.delayPrediction.createMany({data:[{applicationId:workLoan.id,riskLevel:'CAO',delayProbability:.9,predictionTimestamp:new Date('2026-01-01')},{applicationId:workLoan.id,riskLevel:'THAP',delayProbability:.1,predictionTimestamp:new Date('2026-02-01')}]});
  const wa=expect(await call('/assignments/officer-workloads',manager),200,'manager workloads'),wp=expect(await call('/portal-intakes/officers',manager),200,'Portal workloads');check(JSON.stringify(wa)===JSON.stringify(wp),'same workload contract');
  const row=wa.find(x=>x.id===a.user.id),open=await db.loanApplication.count({where:{assignedTo:a.user.id,completedAt:null,currentStage:{not:'HOAN_TAT'},currentStatus:{in:['RECEIVED','CHECKED','SUPPLEMENT_REQUIRED','PENDING_APPRAISAL']}}}),pending=await db.portalRequest.count({where:{assignedTo:a.user.id,status:{in:['ASSIGNED','RETURNED']}}});
  check(row.activeLoanCount===open&&row.pendingIntakeCount===pending&&row.totalAssignedCount===open+pending,'Portal and Loan totals do not double-count accepted requests');
  const all=await db.loanApplication.findMany({where:{assignedTo:a.user.id,completedAt:null,currentStage:{not:'HOAN_TAT'},currentStatus:{in:['RECEIVED','CHECKED','SUPPLEMENT_REQUIRED','PENDING_APPRAISAL']}},include:{delayPredictions:{orderBy:[{predictionTimestamp:'desc'},{id:'desc'}],take:1}}});
  check(row.highRiskLoanCount===all.filter(x=>x.delayPredictions[0]?.riskLevel==='CAO').length,'latest risk only');
  // Prediction dependency fails after commit: owner and receipt must stay successful.
  const {PredictionService}=require('../dist/modules/prediction/prediction.service'),prediction=h.app.get(PredictionService),originalPredict=prediction.predictForApplication;let predictionCalls=0;
  const mlLoan=await loan(),mlRequest=expect(await call(endpoint,a,createBody(mlLoan)),201,'ML failure request'),mlCommand=resolution(mlRequest,{newOfficerId:b.user.id});
  try{prediction.predictForApplication=async()=>{predictionCalls++;throw Error('Synthetic ML failure');};const result=expect(await call(`${endpoint}/${mlRequest.id}/approve`,manager,mlCommand),201,'handover commits despite ML failure');check(result.prediction.status==='FAILED'&&result.currentOwnerId===b.user.id,'truthful failure alongside successful handover');const retry=expect(await call(`${endpoint}/${mlRequest.id}/approve`,manager,mlCommand),201,'retry after ML failure');check(retry.prediction.status==='NOT_REPEATED'&&predictionCalls===1,'retry never claims new prediction');}finally{prediction.predictForApplication=originalPredict;}
  // No manager recipient is a visible condition, never an automatic approval or admin fallback.
  const allManagers=await db.user.findMany({where:{roles:{some:{role:{code:'QUAN_LY'}}},id:{not:a.user.id},isActive:true},select:{id:true}});
  await db.user.updateMany({where:{id:{in:allManagers.map(m=>m.id)}},data:{isActive:false}});
  try{const z=await loan(),zero=expect(await call(endpoint,a,createBody(z)),201,'request without active managers');check(zero.managerRecipientCount===0&&zero.status==='PENDING','zero recipients reported honestly');expect(await call(`${endpoint}/${zero.id}/cancel`,a,resolution(zero)),201,'sender can withdraw ordinary request');}finally{await db.user.updateMany({where:{id:{in:allManagers.map(m=>m.id)}},data:{isActive:true}});}
  // DB partial unique and subject CHECK constraints are installed by the real SQL migration.
  const indexes=await db.$queryRawUnsafe('SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND indexname IN ($2,$3)',h.schema,'coordination_pending_loan_key','coordination_pending_portal_key');check(indexes.length===2,'partial pending unique indexes exist');
  await require('./check-coordination-exceptions.cjs').coordinationExceptions({h,a,b,manager,approver,loan,call,createBody,resolution,expect,check});
  // Separate editable cases for UI acceptance in the same owned schema.
  const uiLoan=await loan();const uiPortal=await db.portalRequest.create({data:{reference:'UI-'+randomUUID(),accountId:account.id,status:'ASSIGNED',assignedTo:a.user.id,formVersion:1,data:{...h.browserData,taxCode:String(6300000000+(++n))}}});
  h.coordinationFixture={a,b,manager,admin,approver,loan,createBody,resolution,call,uiLoan,uiPortal};
  return{pass:true,checks,schema:h.schema};
}
async function main(){let h;try{h=await startIsolated({approvedIntake:true,coordinationMigration:true,uploadRoot:path.resolve(__dirname,'../../.codex_tmp/rollout-uploads-'+randomUUID())});const baseline=await runRolloutChecks(h);console.log(JSON.stringify({baseline}));console.log(JSON.stringify(await runCoordinationChecks(h)));}finally{if(h)console.log(JSON.stringify({cleanup:await h.close()}));}}
module.exports={runCoordinationChecks};
if(require.main===module)main().catch(e=>{console.error('COORDINATION_FAILED:',e.message);process.exitCode=1;});
