/* Real HTTP/PostgreSQL checks in an owned empty namespace only. No public migration/seed. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {startIsolated,runChecks}=require('./check-portal-v2-intake.cjs');
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

async function runMvpChecks(h) {
  const {base,db}=h;let checks=0;
  const check=(value,label)=>{assert.ok(value,label);checks++;};
  async function call(endpoint,{token,role,method='GET',body,binary=false}={}) {
    const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(role)headers['X-Active-Role']=role;
    if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
    const response=await fetch(base+endpoint,{method,headers,body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
    return {status:response.status,data:binary?Buffer.from(await response.arrayBuffer()):await response.json().catch(()=>null)};
  }
  const expect=(r,status,label)=>{check([].concat(status).includes(r.status),`${label}: HTTP ${r.status} ${JSON.stringify(r.data?.message||'')}`);return r.data;};
  const post=(endpoint,actor,body)=>call(endpoint,{...actor,method:'POST',body});
  const put=(endpoint,actor,body)=>call(endpoint,{...actor,method:'PUT',body});
  const fixture=h.browserFixture;
  const login=async username=>{const r=expect(await post('/auth/login',{}, {username,password:fixture.password}),201,'staff login');return {token:r.accessToken,role:'CBTD'};};
  const officer=await login(fixture.officerUsername),otherOfficer=await login('isolated_other_cbtd');
  const portalLogin=async email=>({token:expect(await post('/portal/auth/login',{}, {email,password:fixture.password}),201,'portal login').accessToken});
  const portal=await portalLogin(fixture.portalEmail),foreign=await portalLogin('portal1@example.test');
  const request=await db.portalRequest.findFirstOrThrow({where:{status:'ACCEPTED',loan:{currentStage:'TIEP_NHAN'}}});
  const loanId=request.loanId;
  const snapshot=digest({data:request.data,checklistSnapshot:request.checklistSnapshot});
  const loanBefore=await db.loanApplication.findUniqueOrThrow({where:{id:loanId}});
  const history=()=>db.applicationStageHistory.findFirstOrThrow({where:{applicationId:loanId,exitedAt:null}});
  const historyBefore=await history();
  const {PDFDocument}=require('pdf-lib');const pdfDoc=await PDFDocument.create();pdfDoc.addPage([120,120]);const pdf=Buffer.from(await pdfDoc.save());
  const payload={clientRequestId:randomUUID(),requestContent:'Synthetic public supplement',notes:'INTERNAL_ONLY_FIXTURE',items:[{documentGroup:'B',documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2025',reason:'Provide annual statement'},{documentGroup:'D',documentTypeCode:'D_CAPITAL_PLAN',reason:'Provide corrected plan'}]};
  const creates=await Promise.all([post(`/supplements/${loanId}`,officer,payload),post(`/supplements/${loanId}`,officer,payload)]);
  let s=expect(creates[0],201,'create structured supplement');expect(creates[1],201,'duplicate create');
  check(s.id===creates[1].data.id,'create UUID exactly once');
  expect(await post(`/supplements/${loanId}`,officer,{...payload,requestContent:'Different'}),409,'create UUID payload conflict');
  const sp=`/supplements/${s.id}`,pp=`/portal/requests/${request.id}/supplements/${s.id}`;
  const clean=view=>check(!/INTERNAL_ONLY_FIXTURE|filePath|sha256|requestedBy|requester|operations|createHash/.test(JSON.stringify(view)),'safe public view hides internal metadata');
  clean(s);clean(expect(await call(`/portal/requests/${request.id}/supplements`,portal),200,'owner supplement list'));
  expect(await call(`/portal/requests/${request.id}/supplements`,foreign),404,'foreign owner denied');
  expect(await call(`${sp}/portal-details`,otherOfficer),[403,404],'foreign CBTD denied');
  check((await history()).pausedAt!==null,'create pauses active SLA');
  expect(await put(`${sp}/resolve`,officer,{clientRequestId:randomUUID(),expectedRevision:s.revision}),400,'cannot resolve pending items');
  async function upload(view,item,options={}) {
    const form=new FormData();form.append('expectedRevision',String(options.expectedRevision??view.revision));form.append('clientUploadId',options.id||randomUUID());if(options.supersedesId)form.append('supersedesId',options.supersedesId);form.append('file',new Blob([pdf],{type:'application/pdf'}),'synthetic-supplement.pdf');
    return call(`${pp}/items/${item.id}/files`,{...portal,method:'POST',body:form});
  }
  const uploadId=randomUUID();const uploaded=await Promise.all([upload(s,s.items[0],{id:uploadId}),upload(s,s.items[0],{id:uploadId})]);
  s=expect(uploaded[0],201,'first supplement file');expect(uploaded[1],201,'upload retry');check(s.files.length===1&&uploaded[1].data.files.length===1,'duplicate upload retains one version');
  expect(await upload(s,s.items[1],{expectedRevision:s.revision-1}),409,'stale upload CAS denied');
  s=expect(await upload(s,s.items[1]),201,'second supplement file');clean(s);
  const file=s.files[0];
  const download=`${pp}/files/${file.id}/download`;
  check(expect(await call(download,{...portal,binary:true}),200,'owner file download').equals(pdf),'download bytes match original');
  expect(await call(download,foreign),404,'foreign download denied');
  expect(await call(`${sp}/files/${file.id}/download`,otherOfficer),[403,404],'unassigned staff download denied');
  check(expect(await call(`${sp}/files/${file.id}/download`,{...officer,binary:true}),200,'assigned staff download').equals(pdf),'staff downloads exact file');
  expect(await post(`${pp}/respond`,portal,{expectedRevision:s.revision,clientRequestId:randomUUID(),documentIds:[]}),409,'incomplete manifest denied');
  const responseBody={expectedRevision:s.revision,clientRequestId:randomUUID(),documentIds:s.files.map(f=>f.id)};
  const responses=await Promise.all([post(`${pp}/respond`,portal,responseBody),post(`${pp}/respond`,portal,responseBody)]);
  s=expect(responses[0],201,'respond exact manifest');expect(responses[1],201,'respond retry');
  const firstBatch=(await db.supplementRequest.findUniqueOrThrow({where:{id:s.id}})).portalSupplement.responses[0];
  check(s.items.every(i=>i.status==='SUBMITTED')&&(await history()).pausedAt!==null,'response keeps SLA paused for staff review');
  expect(await upload(s,s.items[0],{supersedesId:file.id}),409,'submitted item locked');
  const reviewBody={expectedRevision:s.revision,clientRequestId:randomUUID(),accepted:false,message:'Please replace unclear statement'};
  s=expect(await put(`${sp}/items/${s.items[0].id}/review`,officer,reviewBody),200,'staff requests replacement');
  expect(await put(`${sp}/items/${s.items[0].id}/review`,officer,reviewBody),200,'review retry');
  expect(await put(`${sp}/items/${s.items[1].id}/review`,officer,{...reviewBody,clientRequestId:randomUUID()}),409,'stale review CAS denied');
  s=expect(await put(`${sp}/items/${s.items[1].id}/review`,officer,{expectedRevision:s.revision,clientRequestId:randomUUID(),accepted:true,message:'Accepted plan'}),200,'accept other item');
  expect(await upload(s,s.items[0]),409,'replacement must cite current version');
  s=expect(await upload(s,s.items[0],{supersedesId:file.id}),201,'upload replacement');
  const replacement=s.files.find(f=>f.supersedesId===file.id);check(replacement.version===2&&s.files.length===3,'immutable version chain');
  s=expect(await post(`${pp}/respond`,portal,{expectedRevision:s.revision,clientRequestId:randomUUID(),documentIds:[replacement.id]}),201,'respond pending replacement only');
  check(digest((await db.supplementRequest.findUniqueOrThrow({where:{id:s.id}})).portalSupplement.responses[0])===digest(firstBatch),'first submitted manifest immutable');
  s=expect(await put(`${sp}/items/${s.items[0].id}/review`,officer,{expectedRevision:s.revision,clientRequestId:randomUUID(),accepted:true,message:'Accepted replacement'}),200,'accept replacement');
  const predictionBefore=await db.delayPrediction.count({where:{applicationId:loanId}});
  const resolveBody={expectedRevision:s.revision,clientRequestId:randomUUID(),notes:'INTERNAL_ONLY_FIXTURE resolve'};
  const resolved=await Promise.all([put(`${sp}/resolve`,officer,resolveBody),put(`${sp}/resolve`,officer,resolveBody)]);
  s=expect(resolved[0],200,'resolve supplement');expect(resolved[1],200,'resolve retry');clean(s);
  const loanAfter=await db.loanApplication.findUniqueOrThrow({where:{id:loanId}}),historyAfter=await history();
  check(s.status==='RESOLVED'&&loanAfter.currentStatus===loanBefore.currentStatus,'resolve restores existing stage status semantics');
  check(loanAfter.supplementCount===loanBefore.supplementCount+1,'one supplement count across retries/replacement');
  check(historyAfter.id===historyBefore.id&&historyAfter.pausedAt===null&&historyAfter.pausedDurationHours>=historyBefore.pausedDurationHours,'resolve resumes same active SLA');
  check(digest({data:(await db.portalRequest.findUniqueOrThrow({where:{id:request.id}})).data,checklistSnapshot:(await db.portalRequest.findUniqueOrThrow({where:{id:request.id}})).checklistSnapshot})===snapshot,'original portal snapshot/data unchanged');
  const mlCount=await db.delayPrediction.count({where:{applicationId:loanId}});
  let mlRuntime=false;try {mlRuntime=(await fetch('http://127.0.0.1:8000/health',{signal:AbortSignal.timeout(1500)})).ok;}catch{}
  if(mlRuntime)check(mlCount===predictionBefore+1,'resolve retry invokes real ML persistence exactly once');
  h.policy.readinessVersion='MVP1';
  const acceptedData=request.data;
  let draft=expect(await post('/portal/requests',portal,{formVersion:2,clientRequestId:randomUUID(),data:{...acceptedData,revenuePeriod:'2025'}}),201,'create MVP1 draft');
  const rp=()=>`/portal/requests/${draft.id}`;
  let readiness=expect(await call(`${rp()}/readiness`,portal),200,'readiness without annual source');
  check(!readiness.dataReady&&readiness.issues.some(i=>i.code==='ANNUAL_SOURCE'),'missing annual source draft only');
  for(const [group,coverage]of [['A',[{documentTypeCode:'A_BUSINESS_REGISTRATION'}]],['B',[{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2024'},{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2025'}]],['C',[{documentTypeCode:'C_PURCHASE_ORDER'}]],['D',[{documentTypeCode:'D_CAPITAL_PLAN'}]]]) {
    const form=new FormData();form.append('documentGroup',group);form.append('coverage',JSON.stringify(coverage));form.append('expectedRevision',String(draft.revision));form.append('clientUploadId',randomUUID());form.append('file',new Blob([pdf],{type:'application/pdf'}),'mvp-fixture.pdf');
    draft=expect(await call(`${rp()}/documents`,{...portal,method:'POST',body:form}),201,'MVP upload');
  }
  const finance=draft.documents.find(d=>d.documentGroup==='B');
  const edit=async overrides=>{draft=expect(await put(rp(),portal,{expectedRevision:draft.revision,data:{...draft.data,...overrides}}),200,'MVP data update');};
  await edit({annualRevenueBasis:{documentId:finance.id,fullYearCompleted:true},revenuePeriod:'2025-Q4'});
  readiness=expect(await call(`${rp()}/readiness`,portal),200,'quarter readiness');check(!readiness.dataReady&&readiness.issues.some(i=>i.code==='ANNUAL_PERIOD'),'quarter cannot annualize');
  expect(await post(`${rp()}/submit`,portal,{expectedRevision:draft.revision,documentIds:draft.documents.map(d=>d.id)}),400,'invalid period blocks MVP test submit');
  await edit({revenuePeriod:'2025',annualRevenueBasis:{documentId:draft.documents.find(d=>d.documentGroup==='A').id,fullYearCompleted:true}});
  readiness=expect(await call(`${rp()}/readiness`,portal),200,'wrong source readiness');check(!readiness.dataReady,'registration cannot provide annual revenue source');
  await edit({annualRevenueBasis:{documentId:finance.id,fullYearCompleted:true}});
  readiness=expect(await call(`${rp()}/readiness`,portal),200,'valid annual source');check(readiness.dataReady&&readiness.canSubmit===false&&readiness.creditDecision===null,'readiness remains separate from credit/policy activation');
  const submitted=expect(await post(`${rp()}/submit`,portal,{expectedRevision:draft.revision,documentIds:draft.documents.map(d=>d.id)}),201,'MVP test policy submit with annual source');
  check(submitted.checklistSnapshot.policy.readinessVersion==='MVP1','MVP readiness version frozen');
  const managerToken=expect(await post('/auth/login',{}, {username:fixture.managerUsername,password:fixture.password}),201,'manager login').accessToken;
  const staff=await db.user.findUniqueOrThrow({where:{username:fixture.officerUsername}});
  expect(await post(`/portal-intakes/${draft.id}/assign`,{token:managerToken,role:'QUAN_LY'},{officerId:staff.id,expectedAssignedTo:null}),201,'assign MVP intake');
  // Reuse the baseline's already accepted Company without creating or changing Company data.
  const existingCompany=await db.company.findUniqueOrThrow({where:{taxCode:acceptedData.taxCode}});
  const companyHash=digest(existingCompany);
  expect(await post(`/portal-intakes/${draft.id}/accept`,officer,{confirmExistingCompany:true}),409,'matching Company requires financial source acknowledgement');
  expect(await post(`/portal-intakes/${draft.id}/accept`,officer,{confirmExistingCompany:true,confirmExistingCompanyFinancials:true}),201,'explicit financial acknowledgement accepted');
  check(digest(await db.company.findUniqueOrThrow({where:{id:existingCompany.id}}))===companyHash,'financial acknowledgement preserves existing Company');
  return {pass:true,httpAndDatabaseChecks:checks,mlAfterResolve:{runtime:mlRuntime,persisted:mlCount-predictionBefore},limits:mlRuntime?[]:['ML health unavailable; no mock used, resolve persistence verified separately.']};
}

module.exports={runMvpChecks};
async function runLegacyWorkflow(h) {
  // The existing broad workflow suite uses these fixture login names. Create them
  // only in this harness-owned namespace, never by running public seed.js.
  assert.match(h.schema,/^portal_v2_it_[a-z0-9_]+$/);
  const bcrypt=require('bcryptjs'),{spawn}=require('node:child_process');
  const passwordHash=await bcrypt.hash('123456',10);
  for(const [username,code] of [['test_admin','ADMIN'],['test_quan_ly','QUAN_LY'],['test_cbtd','CBTD']]) {
    const role=await h.db.role.findUniqueOrThrow({where:{code}});
    await h.db.user.create({data:{username,passwordHash,fullName:'Synthetic isolated workflow',email:`${username}@example.test`,roles:{create:{roleId:role.id}}}});
  }
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(__dirname,'check-workflow.cjs')],{cwd:path.resolve(__dirname,'..'),env:{...process.env,TEST_API_URL:h.base},windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
    const timer=setTimeout(()=>{child.kill();reject(Error('Isolated legacy workflow timeout'));},60000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);if(code!==0)return reject(Error('Legacy workflow failed: '+output.slice(-1200)));const matched=output.match(/PASS: (\d+) API checks/);if(!matched)return reject(Error('Legacy workflow did not report assertions'));resolve({pass:true,httpChecks:Number(matched[1]),scope:'Existing broad V1 workflow suite in isolated schema'});});
  });
}
if(require.main===module)(async()=>{
  let h,result,error,cleanup;const owned=new Set(),dir=path.resolve(__dirname,'../uploads/supplements');
  const prior=new Set(await fs.readdir(dir).catch(e=>{if(e.code==='ENOENT')return [];throw e;}));
  const originalWrite=fs.writeFile;
  try {
    h=await startIsolated();const harnessWrite=fs.writeFile;
    fs.writeFile=async function(file,bytes,options){const result=await harnessWrite.call(this,file,bytes,options);const target=path.resolve(String(file));if(options?.flag==='wx'&&path.dirname(target)===dir&&!prior.has(path.basename(target)))owned.add(path.basename(target));return result;};
    const regression=await runChecks(h);const mvp=await runMvpChecks(h);const workflow=await runLegacyWorkflow(h);result={regression,mvp,workflow};
  }catch(e){error=e;}
  finally {
    try {
      if(h)for(const r of await h.db.supplementRequest.findMany())for(const f of r.portalSupplement?.files||[])owned.add(f.filePath);
      for(const name of owned){assert.match(name,/^[0-9a-f-]{36}$/i);assert.ok(!prior.has(name));const target=path.resolve(dir,name);assert.equal(path.dirname(target),dir);await fs.unlink(target).catch(e=>{if(e.code!=='ENOENT')throw e;});}
      for(const name of prior)assert.ok((await fs.readdir(dir)).includes(name),'pre-existing supplement file preserved');
    }catch(e){error=error||e;}
    finally {
      try {cleanup=await h?.close();}catch(e){error=error||e;}
      fs.writeFile=originalWrite;
    }
  }
  if(error){console.error(JSON.stringify({pass:false,error:error.message,stack:error.stack?.split('\n').slice(0,4),cleanup}));process.exitCode=1;}
  else console.log(JSON.stringify({pass:true,...result,cleanup:{...cleanup,supplementFilesRemoved:owned.size,preExistingSupplementFilesPreserved:prior.size}}));
})();


