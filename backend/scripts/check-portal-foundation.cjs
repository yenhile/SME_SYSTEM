/* Development integration. Own tagged accounts/requests only; no seed/reset.
 * Requires running local backend with NODE_ENV=development and preview=true. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const bcrypt=require('bcryptjs');
const {PrismaClient}=require('@prisma/client');
const {PDFDocument}=require('pdf-lib');
const root=path.resolve(__dirname,'..');
const base=process.env.TEST_PORTAL_API_URL||'http://127.0.0.1:3000/api';
const tag=`foundation_it_${Date.now()}_${randomUUID().slice(0,8)}`;
const accounts=[];let prisma;let checks=0;
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function call(url,token,method='GET',body,raw=false) {
  const headers={};if(token)headers.Authorization=`Bearer ${token}`;
  if(body!==undefined && !(body instanceof FormData))headers['Content-Type']='application/json';
  const r=await fetch(base+url,{method,headers,body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  return {status:r.status,data:raw?Buffer.from(await r.arrayBuffer()):await r.json().catch(()=>null)};
}
async function expect(url,token,method,body,status=200,raw=false) {
  const r=await call(url,token,method,body,raw);assert.equal(r.status,status,`${method} ${url}: HTTP ${r.status} ${JSON.stringify(r.data?.message)}`);checks++;return r.data;
}
async function account() {
  const email=`${tag}_${accounts.length}@example.test`;
  const a=await prisma.portalAccount.create({data:{email,passwordHash:await bcrypt.hash('FoundationTest123',10),contactName:tag,phone:'0900000000',verifiedAt:new Date()}});accounts.push(a.id);
  return (await expect('/portal/auth/login',null,'POST',{email,password:'FoundationTest123'},201)).accessToken;
}
async function pdf(text) {const p=await PDFDocument.create();p.addPage().drawText(text);return Buffer.from(await p.save());}
function form(buffer,revision,key,coverage=[{documentTypeCode:'A_BUSINESS_REGISTRATION'}],group='A') {
  const f=new FormData();f.append('documentGroup',group);f.append('coverage',JSON.stringify(coverage));f.append('clientUploadId',key);f.append('expectedRevision',String(revision));f.append('file',new Blob([buffer]),'bundle.pdf');return f;
}
async function cleanup() {
  if(!prisma)return;
  const rs=await prisma.portalRequest.findMany({where:{accountId:{in:accounts}},select:{id:true}});const ids=rs.map(r=>r.id);
  const docs=await prisma.portalDocument.findMany({where:{requestId:{in:ids}},select:{filePath:true}});
  await prisma.$transaction(async tx=>{
    await tx.internalNotification.deleteMany({where:{requestId:{in:ids}}});
    await tx.portalDocument.updateMany({where:{requestId:{in:ids}},data:{supersedesId:null}});
    await tx.portalDocument.deleteMany({where:{requestId:{in:ids}}});
    await tx.portalRequest.deleteMany({where:{id:{in:ids}}});
    await tx.portalAccount.deleteMany({where:{id:{in:accounts}}});
  });
  for(const d of docs) {assert.equal(path.basename(d.filePath),d.filePath);await fs.unlink(path.join(root,'uploads',d.filePath)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
(async()=>{
  assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local API only');
  const cfg=require('dotenv').parse(await fs.readFile(path.join(root,'.env')));
  const db=new URL(cfg.DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(db.hostname) && db.pathname==='/sme_loan','Approved development DB only');
  process.env.DATABASE_URL=cfg.DATABASE_URL;prisma=new PrismaClient();
  const token=await account(),other=await account();
  await expect('/portal/requests/form-config',null,'GET',undefined,401);
  const config=await expect('/portal/requests/form-config',token,'GET');equal(config.policyStatus,'PENDING_POLICY');equal(config.canSubmit,false);
  const legacy=await expect('/portal/requests',token,'POST',{data:{}},201);equal(legacy.formVersion,1);equal(legacy.checklistVersion,'legacy-v1');
  const r=await expect('/portal/requests',token,'POST',{formVersion:2,data:{hasExistingDebt:false,collateral:{mode:'NONE_REQUESTED'}}},201);equal(r.revision,0);equal(r.loanId,null);
  const u=`/portal/requests/${r.id}`;
  await expect(u,other,'GET',undefined,404);
  await expect(`${u}/checklist`,other,'GET',undefined,404);
  await expect(u,token,'PUT',{data:{neededAt:'2026-02-30'},expectedRevision:0},400);
  await expect(u,token,'PUT',{data:{}},400);
  const saved=await expect(u,token,'PUT',{data:{hasExistingDebt:false,capitalPlan:{costs:[],ownFunds:0}},expectedRevision:0});equal(saved.revision,1);
  const races=await Promise.all([call(u,token,'PUT',{data:{contactName:'first'},expectedRevision:1}),call(u,token,'PUT',{data:{contactName:'second'},expectedRevision:1})]);equal(races.map(x=>x.status).sort(),[200,409]);
  const first=await pdf('First version'),second=await pdf('Second version');
  await expect(`${u}/documents`,other,'POST',form(first,2,'first-upload'),404);
  await expect(`${u}/documents`,token,'POST',form(first,2,'bad-coverage',[{documentTypeCode:'E_COLLATERAL_TITLE'}]),400);
  let uploaded=await expect(`${u}/documents`,token,'POST',form(first,2,'first-upload'),201);equal(uploaded.revision,3);equal(uploaded.documents.length,1);
  const original=uploaded.documents[0].id;
  uploaded=await expect(`${u}/documents`,token,'POST',form(first,2,'first-upload'),201);equal(uploaded.revision,3);equal(uploaded.documents.length,1);
  await expect(`${u}/documents`,token,'POST',form(second,3,'first-upload'),409);
  await expect(`${u}/documents/${original}/replace`,token,'POST',form(second,2,'replace-stale'),409);
  uploaded=await expect(`${u}/documents/${original}/replace`,token,'POST',form(second,3,'replace-upload'),201);equal(uploaded.documents.length,1);equal(uploaded.documents[0].version,2);equal(uploaded.documents[0].supersedesId,original);
  const latest=uploaded.documents[0].id;
  await expect(`${u}/documents/${original}/replace`,token,'POST',form(first,4,'replace-obsolete'),409);
  const history=await expect(`${u}/documents/${latest}/versions`,token,'GET');equal(history.length,2);equal(history[0].version,1);
  assert.ok(history.every(d=>!('filePath'in d) && !('contentHash'in d)));checks++;
  equal(await expect(`${u}/documents/${original}/download`,token,'GET',undefined,200,true),first);
  await expect(`${u}/documents/${latest}/versions`,other,'GET',undefined,404);
  await expect(`${u}/documents/${latest}`,token,'DELETE',{expectedRevision:3},409);
  const withdrawn=await expect(`${u}/documents/${latest}`,token,'DELETE',{expectedRevision:4});equal(withdrawn.documents.length,0);equal(withdrawn.revision,5);
  equal(await expect(`${u}/documents/${latest}/download`,token,'GET',undefined,200,true),second);
  const all=await expect(`${u}/documents/${original}/versions`,token,'GET');assert.ok(all[1].withdrawnAt);checks++;
  equal(await prisma.portalDocument.count({where:{requestId:r.id}}),2);
  await expect(`${u}/submit`,token,'POST',{},409);
  equal((await expect(u,token,'GET')).loanId,null);
  equal(await prisma.internalNotification.count({where:{requestId:r.id}}),0);
  const multi=await expect(`${u}/documents`,token,'POST',form(first,5,'finance-bundle',[{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2024'},{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2025'}],'B'),201);
  equal(multi.documents[0].coverage.length,2);
  const checklist=await expect(`${u}/checklist`,token,'GET');equal(checklist.cannotSubmit,true);
  // Re-evaluation must retain files and must not invent an exemption/approval.
  const changed=await expect(u,token,'PUT',{data:{loanType:'VAY_VON_LUU_DONG',hasExistingDebt:false,collateral:{mode:'NONE_REQUESTED'}},expectedRevision:6});equal(changed.documents.length,1);
  equal((await expect(`${u}/checklist`,token,'GET')).policyStatus,'PENDING_POLICY');
})().then(()=>console.log(`Portal foundation integration: ${checks} checks passed`)).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{try{await cleanup();}catch(e){console.error('Fixture cleanup failed: '+e.message);process.exitCode=1;}await prisma?.$disconnect();});
