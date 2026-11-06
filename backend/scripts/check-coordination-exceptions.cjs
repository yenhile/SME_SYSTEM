// Additional real transaction interleavings and linked-Portal exceptions; owned schema only.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
async function coordinationExceptions({h,a,b,manager,approver,loan,call,createBody,resolution,expect,check}){
  const {db}=h,endpoint='/assignment-change-requests';
  const collisionLoans=await Promise.all([loan(),loan()]),collisionId=randomUUID();
  const collisions=await Promise.all(collisionLoans.map(l=>call(endpoint,a,{...createBody(l),clientRequestId:collisionId})));
  check(collisions.filter(r=>r.status===201).length===1&&collisions.filter(r=>r.status===409).length===1,'same create UUID across concurrent subjects is a conflict, not server failure');
  const collisionWinner=collisions.find(r=>r.status===201).data;expect(await call(`${endpoint}/${collisionWinner.id}/cancel`,a,resolution(collisionWinner)),201,'cancel collision fixture');
  function gate(){let release,hit;return{wait:new Promise(r=>release=r),arrived:new Promise(r=>hit=r),release:()=>release(),hit:()=>hit()};}
  async function paused(service,model,method,work){
    const original=service.prisma,g=gate();let used=false;
    service.prisma=new Proxy(original,{get(target,key){if(key!=='$transaction'){const v=target[key];return typeof v==='function'?v.bind(target):v;}return(fn,options)=>target.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k!==model){const v=t[k];return typeof v==='function'?v.bind(t):v;}return new Proxy(t[k],{get(m,n){if(n!==method)return typeof m[n]==='function'?m[n].bind(m):m[n];return async args=>{if(!used){used=true;g.hit();await g.wait;}return m[n](args);};}});}})),options);}});
    try{return await work(g);}finally{g.release();service.prisma=original;}
  }
  const {AssignmentChangeRequestsService}=require('../dist/modules/assignments/assignment-change-requests.service'),{CompaniesService}=require('../dist/modules/companies/companies.service');
  async function companyPayload(l,name){const c=await db.company.findUniqueOrThrow({where:{id:l.companyId}});return{...Object.fromEntries(['taxCode','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address'].map(k=>[k,c[k]])),companyName:name};}
  let l=await loan(),payload=await companyPayload(l,'Synthetic blocked race update');
  await paused(h.app.get(AssignmentChangeRequestsService),'assignmentChangeRequest','create',async g=>{
    const creating=call(endpoint,a,createBody(l,'CONFLICT_OF_INTEREST'));await g.arrived;
    let settled=false;const writing=call('/companies',a,payload).then(r=>{settled=true;return r;});await new Promise(r=>setTimeout(r,100));check(!settled,'Company waits for COI actor/taxCode lock');g.release();
    const r=expect(await creating,201,'COI wins Company race');expect(await writing,403,'Company checks conflict after lock');expect(await call(`${endpoint}/${r.id}/reject`,manager,resolution(r,{confirmCanContinue:true,resolutionCode:'NO_CONFLICT_CONFIRMED'})),201,'resolve race fixture');
  });
  l=await loan();payload=await companyPayload(l,'Synthetic write before conflict');
  await paused(h.app.get(CompaniesService),'company','upsert',async g=>{
    const writing=call('/companies',a,payload);await g.arrived;let settled=false;
    const creating=call(endpoint,a,createBody(l,'CONFLICT_OF_INTEREST')).then(r=>{settled=true;return r;});await new Promise(r=>setTimeout(r,100));check(!settled,'COI waits for Company transaction');g.release();
    expect(await writing,201,'Company write completes before COI');const r=expect(await creating,201,'COI starts after Company write');expect(await call('/companies',a,{...payload,companyName:'Synthetic forbidden later update'}),403,'later Company write blocked');expect(await call(`${endpoint}/${r.id}/reject`,manager,resolution(r,{confirmCanContinue:true,resolutionCode:'NO_CONFLICT_CONFIRMED'})),201,'resolve second race fixture');
  });
  // A stale manager screen is a conflict, not a reason to close a still-valid request.
  l=await loan();let r=expect(await call(endpoint,a,createBody(l)),201,'stale decision fixture');
  expect(await call(`${endpoint}/${r.id}/reject`,manager,{...resolution(r,{confirmCanContinue:true}),expectedRequestVersion:99}),409,'stale request version');
  check((await db.assignmentChangeRequest.findUniqueOrThrow({where:{id:r.id}})).status==='PENDING','stale UI keeps valid pending request');
  expect(await call(`${endpoint}/${r.id}/cancel`,a,resolution(r)),201,'cancel stale fixture');
  // Inject a database error at notices, after owner/history writes would have occurred.
  async function notificationFault(predicate,run){
    assert.match(h.schema,/^portal_v2_it_[a-z0-9_]+$/);const q=`"${h.schema}"`;
    await db.$executeRawUnsafe(`CREATE FUNCTION ${q}.coordination_notice_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${predicate} THEN RAISE EXCEPTION 'synthetic coordination rollback'; END IF; RETURN NEW; END $$`);
    try{await db.$executeRawUnsafe(`CREATE TRIGGER coordination_notice_fault BEFORE INSERT ON ${q}.internal_notifications FOR EACH ROW EXECUTE FUNCTION ${q}.coordination_notice_fault()`);try{await run();}finally{await db.$executeRawUnsafe(`DROP TRIGGER coordination_notice_fault ON ${q}.internal_notifications`);}}finally{await db.$executeRawUnsafe(`DROP FUNCTION ${q}.coordination_notice_fault()`);}
  }
  l=await loan();
  await notificationFault('NEW.assignment_change_request_id IS NOT NULL',async()=>{expect(await call(endpoint,a,createBody(l)),500,'request notice fault surfaced');check(await db.assignmentChangeRequest.count({where:{applicationId:l.id}})===0,'create notice fault rolls back request');});
  r=expect(await call(endpoint,a,createBody(l)),201,'request after rollback');assert.match(l.id,/^[a-f0-9-]{36}$/i);
  await notificationFault(`NEW.application_id = '${l.id}'`,async()=>{
    expect(await call(`${endpoint}/${r.id}/approve`,manager,resolution(r,{newOfficerId:b.user.id})),500,'handover notice fault surfaced');
    const stored=await db.loanApplication.findUniqueOrThrow({where:{id:l.id}});check(stored.assignedTo===a.user.id&&stored.assignmentVersion===0,'fault rolls back owner/version');check(await db.applicationAssignment.count({where:{applicationId:l.id}})===0&&(await db.assignmentChangeRequest.findUniqueOrThrow({where:{id:r.id}})).status==='PENDING','fault rolls back history and approval result');
  });
  expect(await call(`${endpoint}/${r.id}/approve`,manager,resolution(r,{newOfficerId:b.user.id})),201,'retry after handover rollback');
  // Loan completion closes an ordinary request in the same real workflow transaction.
  l=await loan();await db.loanApplication.update({where:{id:l.id},data:{businessPolicyVersion:null,currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',officialAmount:100000000,isDocumentComplete:true}});
  r=expect(await call(endpoint,a,createBody(l)),201,'request before terminal workflow');
  expect(await call(`/workflow/${l.id}/transition`,approver,{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:100000000,interestRate:8}),201,'existing legacy final decision');
  check((await db.assignmentChangeRequest.findUniqueOrThrow({where:{id:r.id}})).status==='OBSOLETE','terminal transaction closes pending request');
  // Independent authority can still clarify during COI; reports and authors remain intact.
  l=await loan();const evidence=new FormData();evidence.append('file',new Blob([h.browserPdf],{type:'application/pdf'}),'coi-appraisal.pdf');evidence.append('documentType','PHAP_LY');
  expect(await call(`/documents/${l.id}`,a,evidence),201,'appraisal evidence');expect(await call(`/loan-applications/${l.id}/set-amount`,a,{officialAmount:100000000},'PUT'),200,'appraisal amount');expect(await call(`/loan-applications/${l.id}/check-documents`,a,{isComplete:true},'PUT'),200,'appraisal document confirmation');
  let report=expect(await call(`/appraisals/${l.id}/draft`,a,{expectedRevision:0,clientRequestId:randomUUID(),content:h.rolloutFixture.content},'PUT'),200,'draft before COI');
  report=expect(await call(`/appraisals/${l.id}/submit`,a,{expectedRevision:report.revision,clientRequestId:randomUUID()}),201,'submit before COI');
  r=expect(await call(endpoint,a,createBody(l,'CONFLICT_OF_INTEREST')),201,'COI on submitted report');
  expect(await call(`/loan-applications/${l.id}`,a),200,'COI sender keeps existing read access');
  report=expect(await call(`/appraisals/${l.id}/clarify`,approver,{expectedRevision:report.revision,clientRequestId:randomUUID(),message:'Synthetic independent clarification during COI'}),201,'independent clarification remains allowed');
  const stageBefore=await db.applicationStageHistory.findMany({where:{applicationId:l.id}});
  expect(await call(`${endpoint}/${r.id}/approve`,manager,resolution(r,{newOfficerId:b.user.id})),201,'handover a report needing clarification');
  check(await db.appraisalReportVersion.count({where:{report:{applicationId:l.id}}})===1,'handover preserves original report version');
  report=expect(await call(`/appraisals/${l.id}/draft`,b,{expectedRevision:report.revision,clientRequestId:randomUUID(),content:h.rolloutFixture.content},'PUT'),200,'new officer can revise clarified report');
  expect(await call(`/appraisals/${l.id}/submit`,b,{expectedRevision:report.revision,clientRequestId:randomUUID()}),201,'new officer submits revision');
  check(JSON.stringify(await db.applicationStageHistory.findMany({where:{applicationId:l.id}}))===JSON.stringify(stageBefore),'COI handover/clarification never resets stage SLA');
  // Portal intake closes the request, without carrying an old command into the new Loan.
  const account=await db.portalAccount.findUniqueOrThrow({where:{email:h.rolloutFixture.portalEmail}});
  const legacyData=Object.fromEntries(['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address','loanPurpose','loanType','proposedAmount','loanTermMonths'].map(k=>[k,h.browserData[k]]));
  const p=await db.portalRequest.create({data:{reference:'ACCEPT-'+randomUUID(),accountId:account.id,status:'ASSIGNED',assignedTo:a.user.id,formVersion:1,data:{...legacyData,taxCode:'6200000000'}}});
  r=expect(await call(endpoint,a,{subjectType:'PORTAL',subjectId:p.id,expectedAssignmentVersion:0,clientRequestId:randomUUID(),reasonCode:'WORKLOAD',reason:'Synthetic before acceptance'}),201,'Portal request before accept');
  const portalReceiptId=r.id;
  const accepted=expect(await call(`/portal-intakes/${p.id}/accept`,a,{}),201,'Portal accept with ordinary pending request');
  check((await db.assignmentChangeRequest.findUniqueOrThrow({where:{id:r.id}})).resolutionCode==='PORTAL_ACCEPTED','Portal acceptance makes old request obsolete');
  check(await db.assignmentChangeRequest.count({where:{applicationId:accepted.loanId}})===0,'old request is not silently applied to new Loan');
  // Structured supplements stay usable by the enterprise while staff sender is blocked.
  const structured=expect(await call(`/supplements/${accepted.loanId}`,a,{requestContent:'Synthetic financial source',clientRequestId:randomUUID(),items:[{documentGroup:'B',documentTypeCode:'B_FINANCIAL_STATEMENTS',period:h.browserData.revenuePeriod,reason:'Synthetic corrected evidence'}]}),201,'structured supplement fixture');
  const s=await db.supplementRequest.findFirstOrThrow({where:{applicationId:accepted.loanId}}),meta=s.portalSupplement;
  const currentLoan=await db.loanApplication.findUniqueOrThrow({where:{id:accepted.loanId}});r=expect(await call(endpoint,a,createBody(currentLoan,'CONFLICT_OF_INTEREST')),201,'COI on linked Loan');
  expect(await call(`/supplements/${s.id}/items/${meta.items[0].id}/review`,a,{expectedRevision:meta.revision,clientRequestId:randomUUID(),accepted:true},'PUT'),403,'COI blocks structured supplement review');
  expect(await call(`/supplements/${s.id}/return`,a,{expectedRevision:meta.revision,clientRequestId:randomUUID()}),403,'COI blocks structured supplement return');
  const portal={token:h.rolloutFixture.portalToken};
  const files=new FormData();files.append('file',new Blob([h.browserPdf],{type:'application/pdf'}),'enterprise-coi-source.pdf');files.append('expectedRevision',String(meta.revision));files.append('clientUploadId',randomUUID());
  const saved=expect(await call(`/portal/requests/${p.id}/supplements/${s.id}/items/${meta.items[0].id}/files`,portal,files),201,'enterprise upload remains allowed during staff COI');
  expect(await call(`/portal/requests/${p.id}/supplements/${s.id}/respond`,portal,{expectedRevision:saved.revision,clientRequestId:randomUUID(),documentIds:saved.files.filter(x=>!x.supersededById).map(x=>x.id)}),201,'enterprise response remains allowed during COI');
  const publicRequest=expect(await call(`/portal/requests/${p.id}`,portal),200,'enterprise request read');
  check(!JSON.stringify(publicRequest).includes('coordinationRestrictions')&&!JSON.stringify(publicRequest).includes('CONFLICT_OF_INTEREST'),'public Portal hides internal coordination');
  const unrelated=await loan();expect(await call('/companies',a,await companyPayload(unrelated,'Synthetic unrelated allowed Company')),201,'COI does not block unrelated Company');
  expect(await call(`${endpoint}/${r.id}/approve`,manager,resolution(r,{newOfficerId:b.user.id})),201,'handover after enterprise response');
  check(!expect(await call(`${endpoint}/${portalReceiptId}`,a),200,'old Portal receipt after Loan handover').currentCaseLinkAllowed,'historical Portal owner is not current Loan access');
  // Database enforces one subject and one PENDING, independently of the service check.
  l=await loan();r=expect(await call(endpoint,a,createBody(l)),201,'constraint fixture');
  const raw={requestedById:a.user.id,assignmentVersionAtRequest:0,reasonCode:'WORKLOAD',reason:'Synthetic constraint probe',createClientRequestId:randomUUID(),createPayloadHash:'synthetic'};
  await assert.rejects(db.assignmentChangeRequest.create({data:{...raw,applicationId:l.id}}),e=>e.code==='P2002');check(true,'partial unique prevents another pending');
  await assert.rejects(db.assignmentChangeRequest.create({data:{...raw,createClientRequestId:randomUUID()}}),e=>String(e.message).includes('coordination_subject_check'));check(true,'CHECK prevents missing subject');
  expect(await call(`${endpoint}/${r.id}/cancel`,a,resolution(r)),201,'cleanup constraint request');
}
module.exports={coordinationExceptions};
