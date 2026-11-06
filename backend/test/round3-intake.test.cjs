const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require('reflect-metadata');
const previous=require.extensions['.ts'];
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,f);
const {PortalService}=require('../src/modules/portal/portal.service.ts');
const {PortalIntakeWorkflow}=require('../src/modules/portal/portal.intake-workflow.ts');
const {createV2Snapshot}=require('../src/modules/portal/portal.snapshot.ts');
const {intakeChecklist}=require('../src/modules/portal/portal.intake-cycle.ts');
function fixture(){
 const now=new Date('2026-11-02T01:00:00Z');
 const r={id:'request',reference:'FIXTURE',accountId:'enterprise',assignedTo:'officer',formVersion:2,status:'ASSIGNED',revision:2,checklistVersion:'sme-approved-manufacturing-working-capital-2026-10-26-v1',data:{taxCode:'1234567890',companyName:'Published',annualRevenue:100},documents:[],submittedAt:now,loanId:null,correctionHistory:[]};
 const snap=createV2Snapshot(r,{version:r.checklistVersion},[{id:'legal',group:'A',documentTypeCode:'A_BUSINESS_REGISTRATION',required:true,applies:true,due:true}],[{id:'old-file',documentGroup:'A',coverage:[{documentTypeCode:'A_BUSINESS_REGISTRATION'}],fileName:'published.pdf',fileSize:1,mimeType:'application/pdf',uploadedAt:now,version:1,sha256:'abc'}],now);
 r.checklistVersion=require('../src/modules/portal/portal.approved-policy.ts').getPolicyForScope('MANUFACTURING').version;
 snap.checklistVersion=r.checklistVersion;snap.policy.version=r.checklistVersion;
 // Recompute the immutable snapshot after choosing the real registered version.
 const {createHash}=require('crypto');const {integrity,...core}=snap;
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;
 snap.integrity=createHash('sha256').update(JSON.stringify(canonical(core))).digest('hex');
 r.checklistSnapshot=snap;r.documents=snap.documents;
 const s={id:'submission',requestId:r.id,sequence:1,sourceRevision:2,snapshot:snap,submittedAt:now,reviews:intakeChecklist(snap).map(i=>({...i,decision:'ACCEPTED',message:'',reviewerId:'officer',reviewedAt:now.toISOString()})),returnItems:[]};
 const notices=[],operations=[];
 const tx={$queryRaw:async()=>[],portalRequest:{findUnique:async()=>r,findFirst:async()=>r,findMany:async()=>[r],update:async({data})=>{for(const[k,v]of Object.entries(data))r[k]=v&&typeof v==='object'&&'increment'in v?r[k]+v.increment:v;return {...r};}},portalSubmission:{findFirst:async()=>s,findMany:async()=>[s],update:async({data})=>Object.assign(s,data)},portalIntakeOperation:{findUnique:async({where})=>operations.find(x=>x.clientRequestId===where.requestId_clientRequestId.clientRequestId)||null,create:async({data})=>{operations.push(data);return data;}},portalIntakeIssue:{findMany:async()=>[],count:async()=>0},assignmentChangeRequest:{findMany:async()=>[],findFirst:async()=>null},internalNotification:{createMany:async({data})=>{notices.push(...data);return{count:data.length};}},user:{findMany:async()=>[{id:'manager'}]}};
 const db={...tx,$transaction:async fn=>fn(tx)};
 return {r,s,notices,operations,tx,db,service:new PortalService(db),flow:new PortalIntakeWorkflow(db,{},async()=>[])};
}
const body=r=>({expectedRevision:r.revision,clientRequestId:require('crypto').randomUUID()});
test('D3-01 staff list and detail use published data and files while enterprise edits',async()=>{
 const f=fixture();f.r.status='RETURNED';f.r.data={...f.r.data,annualRevenue:999};f.r.documents=[{id:'draft-file',fileName:'not-sent.pdf'}];
 const rows=await f.service.list(undefined,{id:'officer',roles:['CBTD']});
 assert.equal(rows[0].data.annualRevenue,100);assert.equal(rows[0].documents[0].id,'old-file');
 const own=await f.service.list('enterprise');assert.equal(own[0].data.annualRevenue,999);assert.equal(own[0].documents[0].id,'draft-file');
});
test('D3-03 enterprise correction notifies assigned officer and replay creates no duplicate',async()=>{
 const f=fixture(),b={...body(f.r),message:'Please correct data'};
 await f.flow.requestCorrection(f.r.id,b,'enterprise');
 assert.equal(f.r.correctionRequest.status,'PENDING');assert.equal(f.notices.length,1);assert.equal(f.notices[0].userId,'officer');
 await f.flow.requestCorrection(f.r.id,b,'enterprise');assert.equal(f.notices.length,1);
});
test('D3-03 pending correction blocks receive view, including legacy pending JSON',async()=>{
 const f=fixture();f.r.correctionRequest={message:'Pending',requestedAt:new Date().toISOString()};
 assert.equal((await f.flow.view(f.r,false)).canAccept,false);
});
test('D3-03 officer can reject correction with public reason and retained history',async()=>{
 const f=fixture();f.r.correctionRequest={id:'correction',status:'PENDING',message:'Pending',requestedAt:new Date().toISOString()};
 assert.equal(typeof f.flow.decideCorrection,'function');
 await f.flow.decideCorrection(f.r.id,{...body(f.r),submissionId:f.s.id,decision:'REJECT',reason:'The submitted information is correct'}, {id:'officer',roles:['CBTD']});
 assert.equal(f.r.status,'ASSIGNED');assert.equal(f.r.correctionRequest.status,'REJECTED');assert.equal(f.r.correctionHistory.length,1);
 assert.equal((await f.flow.view(f.r,false)).canAccept,true);
});
test('D3-03 approve correction returns data without marking a correct file defective',async()=>{
 const f=fixture();f.r.correctionRequest={id:'correction',status:'PENDING',message:'Phone is wrong',requestedAt:new Date().toISOString()};
 assert.equal(typeof f.flow.decideCorrection,'function');
 await f.flow.decideCorrection(f.r.id,{...body(f.r),submissionId:f.s.id,decision:'APPROVE',reason:'Correct phone number'}, {id:'officer',roles:['CBTD']});
 assert.equal(f.r.status,'RETURNED');assert.equal(f.r.correctionRequest.status,'APPROVED');assert(f.s.returnItems.some(i=>i.documentIds.length===0));
 assert(f.s.reviews.every(i=>i.decision==='ACCEPTED'));
});
test('D3-02 reconciliation operations are provided without granting generic Company write',()=>{
 const f=fixture();assert.equal(typeof f.flow.requestCompanyReconciliation,'function');assert.equal(typeof f.flow.resolveCompanyReconciliation,'function');
});
test('D3-03 receive transaction blocks a pending request before any policy or writes',async()=>{
 const f=fixture();f.r.correctionRequest={status:'PENDING',message:'Data changed'};
 await assert.rejects(f.flow.assertAccept(f.tx,f.r,f.r.revision,f.s.id),e=>e.getStatus()===409&&/xin sửa/.test(e.message));
});
test('D3-03 unrelated officer cannot decide an enterprise correction',async()=>{
 const f=fixture();f.r.correctionRequest={status:'PENDING',message:'Data changed'};
 await assert.rejects(f.flow.decideCorrection(f.r.id,{...body(f.r),submissionId:f.s.id,decision:'APPROVE',reason:'Reason'},{id:'other',roles:['CBTD']}),e=>e.getStatus()===404);
 assert.equal(f.r.status,'ASSIGNED');
});
test('D3-02 loan Company view and amount features retain captured values after master update',()=>{
 const {companySnapshot,companyForLoan}=require('../src/modules/companies/company-snapshot.ts');
 const original={taxCode:'1',companyName:'Old',industry:'Manufacturing',establishedYear:2020,annualRevenue:'100',charterCapital:'50',representativeName:'Rep',phone:'1',address:'A'};
 const loan={company:{...original,companyName:'New',annualRevenue:'200'},companySnapshot:companySnapshot(original)};
 assert.equal(companyForLoan(loan).companyName,'Old');assert.equal(Number(companyForLoan(loan).annualRevenue),100);
 assert.equal(loan.company.companyName,'New');
});
test('D3-02 captured Company timestamps also preserve appraisal evidence identity',()=>{
 const {companySnapshot,companyForLoan}=require('../src/modules/companies/company-snapshot.ts');
 const old={id:'company',taxCode:'1',annualRevenue:100,charterCapital:50,createdAt:new Date('2026-01-01'),updatedAt:new Date('2026-01-02')};
 const loan={company:{...old,updatedAt:new Date('2026-11-02')},companySnapshot:companySnapshot(old)};
 assert.equal(new Date(companyForLoan(loan).updatedAt).toISOString(),old.updatedAt.toISOString());
});
test('D3-02 pending enterprise correction prevents manager from applying Company reconciliation',async()=>{
 const f=fixture();f.r.correctionRequest={status:'PENDING',message:'Please correct data'};
 f.tx.portalIntakeIssue.findFirst=async()=>({id:'issue',createdBy:'officer',kind:'COMPANY_RECONCILIATION',context:{submissionId:f.s.id}});
 await assert.rejects(f.flow.resolveCompanyReconciliation(f.r.id,{...body(f.r),issueId:'issue',decision:'APPROVE',reason:'Verified evidence'},{id:'manager',roles:['QUAN_LY']}),e=>e.getStatus()===409&&/xin sửa/.test(e.message));
});
test.after(()=>{previous?require.extensions['.ts']=previous:delete require.extensions['.ts'];});
