const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const path=require('node:path');
const file=path.resolve(__dirname,'../src/modules/portal/portal.snapshot.ts');
const source=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
const moduleUnderTest=new Module(file,module);moduleUnderTest.filename=file;moduleUnderTest.paths=Module._nodeModulePaths(path.dirname(file));
moduleUnderTest._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {createV2Snapshot,readV2Snapshot,sameJson}=moduleUnderTest.exports;
const r={id:'request',accountId:'owner',formVersion:2,checklistVersion:'sme-preview-v2',revision:3,data:{companyName:'ABC',capitalPlan:{costs:[{name:'Materials',amount:8000000000}]}}};
const policy={version:'TEST-POLICY-1',formVersion:2,status:'TEST_ONLY',requiredFields:[],requirements:[]};
const docs=[{id:'file',documentGroup:'B',fileName:'finance.pdf',fileSize:12,mimeType:'application/pdf',uploadedAt:new Date('2026-10-22T00:00:00Z'),version:3,coverage:[{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2025'}],contentHash:'fingerprint',sha256:'a'.repeat(64)}];
test('snapshot copies all form/rule/file metadata and excludes storage paths',()=>{
  assert.equal(typeof createV2Snapshot,'function');
  const snapshot=createV2Snapshot(r,policy,[],[{...docs[0],filePath:'private-path'}],new Date('2026-10-22T01:00:00Z'));
  assert.equal(snapshot.checklistVersion,policy.version);assert.deepEqual(snapshot.data,r.data);assert.equal(snapshot.documents[0].version,3);
  assert.equal(snapshot.documents[0].filePath,undefined);assert.equal(snapshot.audit.actorAccountId,'owner');
  snapshot.policy.requiredFields.push('companyName');assert.equal(policy.requiredFields.length,0);
});
test('snapshot verifies integrity and frozen request state across JSONB key ordering',()=>{
  const snapshot=createV2Snapshot(r,policy,[],docs,new Date('2026-10-22T01:00:00Z'));
  const sent={...r,checklistVersion:policy.version,submittedAt:new Date(snapshot.submittedAt),checklistSnapshot:snapshot};
  assert.deepEqual(readV2Snapshot(sent),snapshot);
  assert.equal(sameJson({b:2,a:1},{a:1,b:2}),true);
  for(const changed of [{...sent,data:{companyName:'Changed'}},{...sent,revision:4},{...sent,checklistSnapshot:{...snapshot,data:{companyName:'tampered'}}},{...sent,checklistSnapshot:null}])assert.throws(()=>readV2Snapshot(changed),e=>e.getStatus()===409);
});
test('malformed stored document entries fail closed as a conflict',()=>{
  const snapshot=createV2Snapshot(r,policy,[],docs,new Date('2026-10-22T01:00:00Z'));
  const sent={...r,checklistVersion:policy.version,submittedAt:new Date(snapshot.submittedAt),checklistSnapshot:snapshot};
  for(const documents of [[null],[{}],[{...docs[0],id:123}]]) assert.throws(()=>readV2Snapshot({...sent,checklistSnapshot:{...snapshot,documents}}),e=>typeof e.getStatus==='function' && e.getStatus()===409);
});
