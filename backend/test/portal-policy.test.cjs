const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('reflect-metadata');
const source = path.resolve(__dirname, '../src/modules/portal/portal.policy.ts');
const previous = require.extensions['.ts'];
let rules = {};
try {
  require.extensions['.ts'] = (module, filename) => {
    if (!filename.startsWith(path.dirname(source) + path.sep)) {
      if (previous) return previous(module, filename);
      throw new Error('Unexpected TypeScript dependency');
    }
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
    }).outputText, filename);
  };
  if (fs.existsSync(source)) rules = require(source);
} finally {
  if (previous) require.extensions['.ts'] = previous; else delete require.extensions['.ts'];
}
const requirement = (extra={}) => ({id:'financial',group:'B',documentTypeCode:'B_FINANCIAL_STATEMENTS',required:true,stage:'SUBMIT',...extra});
const policy = (extra={}) => ({version:'TEST-fixture',status:'TEST_ONLY',formVersion:2,requiredFields:[],requirements:[requirement()],...extra});
const document = (extra={}) => ({id:'file1',documentGroup:'B',coverage:[{documentTypeCode:'B_FINANCIAL_STATEMENTS'}],...extra});
const evaluate = (...args) => { assert.equal(typeof rules.evaluatePolicy,'function'); return rules.evaluatePolicy(...args); };

test('pure evaluation requires exact types and each period while one file can cover many', () => {
  const p = policy({requirements:[requirement({periods:['2024','2025']})]});
  assert.deepEqual(evaluate(p,{},[document({coverage:[{documentTypeCode:'B_INVENTORY',period:'2024'}]})],'SUBMIT').missing,['financial:2024','financial:2025']);
  const result = evaluate(p,{},[document({coverage:[{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2025'},{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2024'}]})],'SUBMIT');
  assert.deepEqual(result.missing,[]);
  assert.equal(result.requirements[0].applies,true);
  assert.deepEqual(result.requirements[0].periods,['2024','2025']);
});
test('conditions require explicit equality and substitutions must be named', () => {
  const p = policy({requirements:[requirement({condition:{field:'hasExistingDebt',equals:true},alternatives:['B_INVENTORY'],basis:'fixture substitution'})]});
  assert.deepEqual(evaluate(p,{hasExistingDebt:false},[],'SUBMIT').missing,[]);
  assert.equal(evaluate(p,{},[],'SUBMIT').requirements[0].applies,false);
  assert.deepEqual(evaluate(p,{hasExistingDebt:true},[document({coverage:[{documentTypeCode:'B_INVENTORY'}]})],'SUBMIT').missing,[]);
  const nested = policy({requirements:[requirement({condition:{field:'collateral.mode',equals:'PROPOSED'}})]});
  assert.deepEqual(evaluate(nested,{collateral:{mode:'PROPOSED'}},[],'SUBMIT').missing,['financial']);
});
test('a required conditional rule needs its applicability field declared instead of silently waiving', () => {
  for (const phase of ['SUBMIT','INTAKE']) {
    const result = evaluate(policy({requirements:[requirement({condition:{field:'hasExistingDebt',equals:true}})]}),{},[],phase);
    assert.deepEqual(result.formErrors,['Thiếu thông tin điều kiện: hasExistingDebt']);
  }
});
test('withdrawn and superseded files cannot satisfy a requirement', () => {
  for (const documents of [[document({withdrawnAt:'2026-01-01'})],[document(),document({id:'replacement',supersedesId:'file1',coverage:[{documentTypeCode:'B_INVENTORY'}]})]]) assert.deepEqual(evaluate(policy(),{},documents,'SUBMIT').missing,['financial']);
});
test('required property paths and supplied data validate without inventing draft requirements', () => {
  const p = policy({requiredFields:['companyName','capitalPlan.businessActivity']});
  assert.deepEqual(evaluate(p,{},[],'SUBMIT').formErrors,['Thiếu thông tin: companyName','Thiếu thông tin: capitalPlan.businessActivity']);
  assert.deepEqual(evaluate(p,{},[],'INTAKE').formErrors,[]);
  assert.ok(evaluate(policy(),{contactPhone:'bad'},[],'SUBMIT').formErrors.length);
  assert.deepEqual(evaluate(policy({requiredFields:['hasExistingDebt']}),{hasExistingDebt:false},[],'SUBMIT').formErrors,[]);
});
test('intake checks accumulated due requirements and deferral needs an explicit later stage and basis', () => {
  const p = policy({requirements:[requirement({stage:'INTAKE',deferred:true,basis:'fixture deferred until intake'})]});
  assert.deepEqual(evaluate(p,{},[],'SUBMIT').missing,[]);
  assert.deepEqual(evaluate(p,{},[],'INTAKE').missing,['financial']);
  assert.deepEqual(evaluate(policy(),{},[],'INTAKE').missing,['financial']);
  assert.deepEqual(evaluate(policy({requirements:[requirement({stage:'LATER',deferred:true,basis:'fixture'})]}),{},[],'INTAKE').missing,[]);
});
test('invalid policies and coverage fail closed', () => {
  for (const periods of [[undefined], [null], [''], [], ['2025','2025'], ['2025-Q5']]) assert.throws(() => evaluate(policy({requirements:[requirement({periods})]}),{},[],'SUBMIT'),e => [400,409].includes(e.getStatus()));
  for (const p of [policy({status:'PENDING_POLICY'}),policy({version:''}),policy({requiredFields:['__proto__.polluted']}),policy({requirements:[requirement({documentTypeCode:'B_UNKNOWN'})]}),policy({requirements:[requirement({stage:'UNKNOWN'})]}),policy({requirements:[requirement({deferred:true})]}),policy({requirements:[requirement({stage:'INTAKE',deferred:true})]}),policy({requirements:[requirement({alternatives:['B_UNKNOWN']})]}),policy({requirements:[requirement(),requirement()]}),policy({requirements:[requirement({condition:{field:'hasExistingDebt',equals:undefined}})]})]) assert.throws(() => evaluate(p,{},[],'SUBMIT'),e => [400,409].includes(e.getStatus()));
  assert.throws(() => evaluate(policy(),{},[document({coverage:[{documentTypeCode:'A_CHARTER'}]})],'SUBMIT'),e => e.getStatus()===400);
});
test('test policy activation requires injected context plus every isolated environment constraint', () => {
  assert.equal(typeof rules.resolveTestPolicy,'function');
  const keys = ['NODE_ENV','PORTAL_V2_SUBMIT_ENABLED','DATABASE_URL'];
  const saved = keys.map(key => process.env[key]);
  const valid = ['test','true','postgresql://fixture:fixture@localhost:5432/sme_loan?schema=portal_v2_it_fixture'];
  const context = {mode:'isolated-test',policy:policy()};
  try {
    const set = values => keys.forEach((key,i) => { if(values[i]===undefined) delete process.env[key]; else process.env[key]=values[i]; });
    set(valid);
    assert.deepEqual(rules.resolveTestPolicy(context),context.policy);
    assert.throws(() => rules.resolveTestPolicy(),e => e.getStatus()===409);
    for (const values of [['production',valid[1],valid[2]],['test','false',valid[2]],['test','true',valid[2].replace('localhost','example.invalid')],['test','true',valid[2].replace('sme_loan','other')],['test','true',valid[2].replace('portal_v2_it_fixture','public')],['test','true','bad']]) {set(values);assert.throws(() => rules.resolveTestPolicy(context),e=>e.getStatus()===409);}
    set(valid);
    for (const c of [{...context,mode:'normal'},{...context,policy:policy({status:'APPROVED'})},{...context,policy:policy({version:'bank-v2'})}]) assert.throws(()=>rules.resolveTestPolicy(c),e=>e.getStatus()===409);
    assert.equal(require(path.resolve(__dirname,'../src/modules/portal/portal.foundation.ts')).getFormConfig().canSubmit,false);
  } finally {keys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];});}
});
