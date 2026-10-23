const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('reflect-metadata');

// Exercise source without writing dist or depending on another worker's build.
const source = path.resolve(__dirname, '../src/modules/portal/portal.foundation.ts');
const previous = require.extensions['.ts'];
let rules = {};
try {
  require.extensions['.ts'] = (module, filename) => {
    if (!filename.startsWith(path.dirname(source) + path.sep)) {
      if (previous) return previous(module, filename);
      throw new Error('Unexpected TypeScript dependency');
    }
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
  };
  if (fs.existsSync(source)) rules = require(source);
} finally {
  if (previous) require.extensions['.ts'] = previous;
  else delete require.extensions['.ts'];
}

test('preview fails closed unless explicitly enabled in development or test', () => {
  assert.equal(typeof rules.assertPreviewEnabled, 'function');
  const saved = { flag: process.env.PORTAL_FOUNDATION_PREVIEW, env: process.env.NODE_ENV };
  try {
    for (const [flag, env, allowed] of [['true','development',true],['true','test',true],['true','production',false],['true',undefined,false],['false','test',false],[undefined,'development',false]]) {
      if (flag === undefined) delete process.env.PORTAL_FOUNDATION_PREVIEW; else process.env.PORTAL_FOUNDATION_PREVIEW = flag;
      if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
      if (allowed) assert.doesNotThrow(() => rules.assertPreviewEnabled());
      else assert.throws(() => rules.assertPreviewEnabled(), e => e.getStatus() === 409);
    }
  } finally {
    if (saved.flag === undefined) delete process.env.PORTAL_FOUNDATION_PREVIEW; else process.env.PORTAL_FOUNDATION_PREVIEW = saved.flag;
    if (saved.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.env;
  }
});

test('v2 stores an incomplete structured draft without inventing required fields', () => {
  assert.equal(typeof rules.validateDraftV2, 'function');
  assert.deepEqual(rules.validateDraftV2({}), {});
  const draft = {companyName:'Fixture', companyType:'LIMITED', establishedDate:'2020-02-29', contactName:'Fixture', contactPosition:'Director', contactPhone:'0901234567', contactEmail:'fixture@example.invalid', neededAt:'2026-11-01', preferredBranch:'Example', hasExistingDebt:false, collateral:{mode:'UNDECIDED'}, capitalPlan:{businessActivity:'Trade', costs:[{name:'Stock',amount:100,plannedAt:'2026-11-01'}],ownFunds:0, otherFunds:5, otherFundsSource:'Example',useFrom:'2026-11-01',useTo:'2027-01-01',repaymentSource:'Sales',recoveryDate:'2027-02-01'}};
  assert.deepEqual(rules.validateDraftV2(draft), draft);
  assert.deepEqual(rules.validateDraftV2({capitalPlan:{},collateral:{}}), {capitalPlan:{},collateral:{}});
  const incompleteCosts = {capitalPlan:{costs:[{name:'Materials'},{}]}};
  assert.deepEqual(rules.validateDraftV2(incompleteCosts), incompleteCosts);
});

test('v2 rejects unknown keys and invalid inherited fields at every depth', () => {
  assert.equal(typeof rules.validateDraftV2, 'function');
  for (const draft of [{assignedTo:'x'},{formVersion:2},{taxCode:'x'},{loanTermMonths:121},{proposedAmount:1},{capitalPlan:{approved:true}},{capitalPlan:{costs:[{name:'x',amount:1,approved:true}]}},{collateral:{waived:true}}]) {
    assert.throws(() => rules.validateDraftV2(draft), e => e.getStatus() === 400);
  }
});

test('v2 validates real dates, types and bounded amounts without coercion', () => {
  assert.equal(typeof rules.validateDraftV2, 'function');
  for (const draft of [null, [], {establishedDate:'2025-02-29'},{neededAt:'2026-04-31'},{neededAt:'2026-01-01T00:00:00Z'}, {hasExistingDebt:'false'},{contactEmail:'invalid'},{contactName:'x'.repeat(4001)},{collateral:{mode:'WAIVED'}},{capitalPlan:{ownFunds:-1}},{capitalPlan:{otherFunds:Infinity}},{capitalPlan:{costs:[{name:'x',amount:'1'}]}},{capitalPlan:{costs:[{name:'x',amount:1,plannedAt:'bad'}]}}]) {
    assert.throws(() => rules.validateDraftV2(draft), e => e.getStatus() === 400);
  }
});

test('v2 supplied phone and related dates match frontend validation while drafts stay partial', () => {
  for (const draft of [{phone:'abc'}, {contactPhone:'123'}, {establishedDate:'2020-01-01',establishedYear:2021}, {capitalPlan:{useFrom:'2026-12-01',useTo:'2026-01-01'}}]) {
    assert.throws(() => rules.validateDraftV2(draft), e => e.getStatus() === 400);
  }
  for (const draft of [{phone:'+84 (90) 123-4567'}, {establishedDate:'2020-01-01'}, {establishedYear:2020}, {capitalPlan:{useFrom:'2026-01-01'}}, {capitalPlan:{useFrom:'2026-01-01',useTo:'2026-01-01'}}, {capitalPlan:{costs:[{amount:100}],ownFunds:200}}]) assert.deepEqual(rules.validateDraftV2(draft), draft);
});

test('coverage supports several types and periods and canonicalizes ordering', () => {
  assert.equal(typeof rules.validateCoverage, 'function');
  const input = [{documentTypeCode:'B_RECEIVABLES_PAYABLES',period:'2025-Q4'},{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2025'},{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2024'},{documentTypeCode:'B_INVENTORY',period:'2025-12'}];
  const canonical = rules.validateCoverage('B', input);
  assert.equal(canonical.length, 4);
  assert.deepEqual(rules.validateCoverage('B', [...input].reverse()), canonical);
  assert.deepEqual(input[0], {documentTypeCode:'B_RECEIVABLES_PAYABLES',period:'2025-Q4'});
});

test('coverage rejects duplicates, group mismatch and unsupported periods', () => {
  assert.equal(typeof rules.validateCoverage, 'function');
  const item = {documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2025'};
  for (const [group,value] of [['B',[]],['B',[item,item]],['A',[item]],['B',[{...item,period:'last year'}]],['B',[{...item,period:'2025-13'}]],['B',[{...item,period:'2025-Q5'}]],['B',[{...item,extra:1}]],['B',Array(31).fill(item)],['Z',[item]],['B',[{documentTypeCode:'B_UNKNOWN'}]]]) {
    assert.throws(() => rules.validateCoverage(group,value), e => e.getStatus() === 400);
  }
});

test('configuration is plain JSON and every new document type remains pending policy', () => {
  assert.equal(typeof rules.getFormConfig, 'function');
  const config = rules.getFormConfig();
  assert.equal(rules.LEGACY_CHECKLIST_VERSION, 'legacy-v1');
  assert.equal(rules.PREVIEW_CHECKLIST_VERSION, 'sme-preview-v2');
  assert.equal(config.policyStatus, 'PENDING_POLICY');
  assert.equal(config.canSubmit, false);
  assert.deepEqual(JSON.parse(JSON.stringify(config)), config);
  assert.deepEqual(config.groups.map(g => g.code), ['A','B','C','D','E','F']);
  for (const group of config.groups) for (const type of group.documentTypes) {
    assert.equal(type.group, group.code);
    assert.ok(type.description);
    assert.equal(type.ruleVersion, 'PENDING_POLICY');
    assert.deepEqual(type.alternatives, []);
    assert.equal(type.nonApplicabilityBasis, 'PENDING_POLICY');
    assert.equal(type.deferralBasis, 'PENDING_POLICY');
    assert.equal(type.policyStatus, 'PENDING_POLICY');
    assert.equal(type.stage, 'PENDING_POLICY');
    assert.equal(type.applicability, 'PENDING_POLICY');
    assert.equal(type.versionRule, 'APPEND_ONLY');
    assert.equal(type.sendRule, 'PENDING_POLICY');
    assert.equal(type.deferralStatus, 'NOT_APPROVED');
    assert.equal(type.substituteStatus, 'NOT_APPROVED');
    assert.ok(type.purpose && type.formats.length);
  }
  const codes = config.groups.flatMap(group => group.documentTypes.map(type => type.code));
  assert.equal(codes.includes('B_TAX_RETURN'), false);
  assert.equal(codes.includes('B_BANK_STATEMENT'), false);
  for (const code of ['A_REPRESENTATIVE_ID','A_AUTHORIZATION','B_LATEST_FINANCIAL_STATEMENTS','B_RECEIVABLES_PAYABLES','B_INVENTORY','C_PURCHASE_ORDER','C_MATERIAL_CONTRACT','C_QUOTATION','C_PRODUCTION_PLAN','D_LOAN_REQUEST','D_REPAYMENT_CASHFLOW','F_REPAYMENT_SCHEDULE','F_BANK_STATEMENT']) assert.ok(codes.includes(code), code);
  config.groups.length = 0;
  assert.equal(rules.getFormConfig().groups.length, 6);
});

test('checklists preserve unclassified legacy files and block preview submission', () => {
  assert.equal(typeof rules.checklistFor, 'function');
  const legacy = rules.checklistFor({documents:[{id:'old',documentGroup:'A',coverage:null}]});
  assert.equal(legacy.checklistVersion, 'legacy-v1');
  assert.equal(legacy.groups.length, 6);
  assert.equal(legacy.groups[0].required, true);
  assert.deepEqual(legacy.groups[0].documents[0].coverage, null);
  const preview = rules.checklistFor({formVersion:2,checklistVersion:'sme-preview-v2',documents:[]});
  assert.equal(preview.policyStatus, 'PENDING_POLICY');
  assert.equal(preview.cannotSubmit, true);
  assert.equal(preview.checklistVersion, 'sme-preview-v2');
  assert.equal(preview.groups.some(g => g.required === true), false);
});

test('unknown or mismatched checklist versions remain identifiable and fail closed', () => {
  for (const request of [{formVersion:1,checklistVersion:'future-v3'},{formVersion:1,checklistVersion:'sme-preview-v2'},{formVersion:2,checklistVersion:'legacy-v1'}]) {
    const checklist = rules.checklistFor(request);
    assert.equal(checklist.checklistVersion, request.checklistVersion);
    assert.equal(checklist.cannotSubmit, true);
    assert.equal(checklist.policyStatus, 'UNSUPPORTED_VERSION');
    assert.equal(checklist.groups.some(group => group.required === true), false);
  }
});
