const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('reflect-metadata');

const sourceRoot = path.resolve(__dirname, '../src');
const policyFile = path.join(sourceRoot, 'modules/portal/portal.approved-policy.ts');
const previous = require.extensions['.ts'];
let api = {}, foundation, PortalService;
try {
  require.extensions['.ts'] = (module, filename) => {
    if (!filename.startsWith(sourceRoot + path.sep)) throw new Error('Unexpected source dependency');
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true },
    }).outputText, filename);
  };
  if (fs.existsSync(policyFile)) api = require(policyFile);
  foundation = require(path.join(sourceRoot, 'modules/portal/portal.foundation.ts'));
  ({ PortalService } = require(path.join(sourceRoot, 'modules/portal/portal.service.ts')));
} finally {
  if (previous) require.extensions['.ts'] = previous; else delete require.extensions['.ts'];
}

const components = ['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW_STATEMENT', 'NOTES'];
const reference = '2026-10-26T09:00:00+07:00';
function policy() {
  assert.equal(typeof api.getApprovedPolicy, 'function', 'approved registry must exist');
  return api.getApprovedPolicy();
}
function data(extra = {}) {
  return {
    taxCode: '1234567890', companyName: 'Synthetic Manufacturing', industry: 'Sản xuất',
    establishedYear: 2020, annualRevenue: 0, charterCapital: 500000000,
    representativeName: 'Synthetic Representative', phone: '0900000000', address: 'Synthetic address',
    loanPurpose: 'Nguyên vật liệu', loanType: 'VAY_VON_LUU_DONG', proposedAmount: 100000000,
    loanTermMonths: 12, businessScope: 'MANUFACTURING', revenuePeriod: '2025',
    annualRevenueBasis: { documentId: 'finance', fullYearCompleted: true },
    representative: { mode: 'LEGAL_REPRESENTATIVE' },
    submissionDeclaration: { accepted: true, version: 'portal-enterprise-submission-v1' },
    hasExistingDebt: false, collateral: { mode: 'NONE_REQUESTED' }, ...extra,
  };
}
function documents() {
  const document = (id, group, code) => ({ id, documentGroup: group, coverage: [{ documentTypeCode: code }] });
  return [
    document('registration', 'A', 'A_BUSINESS_REGISTRATION'), document('charter', 'A', 'A_CHARTER'),
    document('authority', 'A', 'A_REPRESENTATIVE_AUTHORITY'), document('identity', 'A', 'A_REPRESENTATIVE_ID'),
    { id: 'finance', documentGroup: 'B', coverage: [{ documentTypeCode: 'B_FINANCIAL_STATEMENTS', period: '2025', components }] },
    document('production', 'C', 'C_PRODUCTION_PLAN'), document('output', 'C', 'C_BUSINESS_CONTRACT'),
    document('request', 'D', 'D_LOAN_REQUEST'), document('plan', 'D', 'D_CAPITAL_PLAN'),
  ];
}
function evaluate(input = data(), files = documents(), options = {}) {
  assert.equal(typeof api.evaluateIntakeReadiness, 'function');
  return api.evaluateIntakeReadiness(policy(), input, files, { phase: 'SUBMIT', submittedAt: reference, ...options });
}

test('approved demo registry is server-owned, copied and separate from activation', () => {
  const first = policy();
  assert.equal(first.status, 'APPROVED');
  assert.ok(!first.version.startsWith('TEST-'));
  first.requirements.length = 0;
  assert.ok(policy().requirements.length > 0);
  assert.throws(() => api.getApprovedPolicy('TEST-injected'), error => error.getStatus() === 409);
  const description = api.describeApprovedPolicy();
  assert.equal(description.canSubmit, false);
  assert.equal(description.canAccept, false);
  assert.equal(description.activationStatus, 'IMPLEMENTATION_INCOMPLETE');
  assert.equal(description.policy.status, 'APPROVED');
});

test('complete declared evidence is data-ready, never a verified document or credit decision', () => {
  const input = data(), files = documents(), before = structuredClone({ input, files });
  const result = evaluate(input, files);
  assert.equal(result.dataReady, true);
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.missingDocuments, []);
  assert.equal(result.businessValidity, 'NOT_REVIEWED');
  assert.equal(result.creditDecision, null);
  assert.equal(result.canSubmit, false);
  assert.equal(result.canAccept, false);
  assert.equal(result.annualPeriod, '2025');
  assert.deepEqual({ input, files }, before);
});

test('each checklist item describes evidence, correction location and officer review', () => {
  const result = evaluate({}, []);
  assert.equal(result.dataReady, false);
  for (const item of result.requirements) {
    assert.ok(item.id && item.label && item.guidance && item.reviewCriteria.length);
    assert.equal(item.step, 4);
    assert.ok(['MISSING', 'NOT_APPLICABLE', 'LATER'].includes(item.state));
  }
  assert.ok(result.missingFields.includes('taxCode'));
  assert.ok(result.missingFields.includes('hasExistingDebt'));
  assert.ok(result.missingFields.includes('representative.mode'));
});

test('one file or several files can declare the four financial components', () => {
  const files = documents();
  files.find(file => file.id === 'finance').coverage[0].components = [components[0]];
  assert.equal(evaluate(data(), files).dataReady, false);
  assert.equal(evaluate(data(), files).missingDocuments.length, 3);
  for (const [index, component] of components.slice(1).entries()) {
    files.push({ id: `finance-${index}`, documentGroup: 'B', coverage: [{ documentTypeCode: 'B_FINANCIAL_STATEMENTS', period: '2025', components: [component] }] });
  }
  assert.equal(evaluate(data({ annualRevenueBasis: { documentId: 'finance-0', fullYearCompleted: true } }), files).dataReady, true);
});

test('revenue source must declare the income statement rather than an unrelated financial component', () => {
  const files = documents();
  files.find(file => file.id === 'finance').coverage[0].components = ['BALANCE_SHEET'];
  files.push({ id: 'income-and-rest', documentGroup: 'B', coverage: [{ documentTypeCode: 'B_FINANCIAL_STATEMENTS', period: '2025', components: components.slice(1) }] });
  const result = evaluate(data(), files);
  assert.equal(result.dataReady, false);
  assert.ok(result.issues.some(issue => issue.code === 'ANNUAL_SOURCE'));
});

test('a generic financial file cannot silently satisfy the four-component rule', () => {
  const files = documents();
  delete files.find(file => file.id === 'finance').coverage[0].components;
  assert.equal(evaluate(data(), files).missingDocuments.length, 4);
});

test('financial metadata only accepts named components, canonicalizes without mutation', () => {
  const input = [{ documentTypeCode: 'B_FINANCIAL_STATEMENTS', period: '2025', components: [...components].reverse() }];
  const result = foundation.validateCoverage('B', input);
  assert.deepEqual(result[0].components, [...components].sort());
  assert.deepEqual(input[0].components, [...components].reverse());
  for (const parts of [[], ['UNKNOWN'], ['NOTES', 'NOTES'], 'NOTES']) {
    assert.throws(() => foundation.validateCoverage('B', [{ ...input[0], components: parts }]), error => error.getStatus() === 400);
  }
  assert.throws(() => foundation.validateCoverage('C', [{ documentTypeCode: 'C_INVOICE', components: ['NOTES'] }]), error => error.getStatus() === 400);
});

test('missing annual data stays incomplete while genuine zero remains valid', () => {
  assert.equal(evaluate(data({ annualRevenue: 0 })).dataReady, true);
  for (const input of [data({ annualRevenue: undefined }), data({ revenuePeriod: '2025-Q4' }), data({ annualRevenueBasis: { documentId: 'finance', fullYearCompleted: false } })]) {
    const result = evaluate(input);
    assert.equal(result.dataReady, false);
    assert.equal(result.creditDecision, null);
  }
});

test('annual reference is frozen at submission, including the Vietnamese year boundary', () => {
  assert.equal(evaluate().dataReady, true);
  assert.equal(evaluate(data(), documents(), { phase: 'INTAKE', submittedAt: reference }).dataReady, true);
  assert.equal(evaluate(data({ revenuePeriod: '2024' })).dataReady, false);
  const boundary = evaluate(data(), documents(), { submittedAt: '2025-12-31T17:00:00Z' });
  assert.equal(boundary.annualPeriod, '2025');
  assert.equal(boundary.dataReady, true);
  assert.throws(() => evaluate(data(), documents(), { submittedAt: 'invalid' }), error => error.getStatus() === 400);
});

test('annual evidence cannot predate the company establishment year', () => {
  const result = evaluate(data({ establishedYear: 2026 }));
  assert.equal(result.dataReady, false);
  assert.ok(result.issues.some(issue => issue.code === 'ANNUAL_BEFORE_ESTABLISHMENT'));
});

test('submitted legacy versions are never reassessed with the new approval rules', async () => {
  const request = { id: 'r', formVersion: 2, status: 'SUBMITTED', submittedAt: reference, data: data(), documents: documents() };
  const service = new PortalService({ portalRequest: { findFirst: async () => request } });
  assert.equal((await service.readiness('r', 'owner')).approvedIntakeAssessment, null);
  assert.equal((await service.checklist('r', 'owner')).approvedIntakeAssessment, undefined);
});

test('invalid stored document metadata is disclosed as an incomplete preview', async () => {
  const request = { id: 'r', formVersion: 2, status: 'DRAFT', data: {}, documents: [{ id: 'old', documentGroup: 'B', coverage: null }] };
  const service = new PortalService({ portalRequest: { findFirst: async () => request } });
  const result = await service.readiness('r', 'owner');
  assert.equal(result.approvedIntakeAssessment.dataReady, false);
  assert.equal(result.approvedIntakeAssessment.issues[0].code, 'INVALID_INPUT');
  assert.ok(result.approvedIntakeAssessment.formErrors.length);
});

test('annual source must be active, owned by the same manifest, complete and in the matching year', () => {
  for (const extra of [{ annualRevenueBasis: { documentId: 'foreign', fullYearCompleted: true } }, { revenuePeriod: '2026' }]) {
    assert.equal(evaluate(data(extra)).dataReady, false);
  }
  for (const files of [
    documents().map(file => file.id === 'finance' ? { ...file, withdrawnAt: reference } : file),
    [...documents(), { id: 'replacement', documentGroup: 'B', supersedesId: 'finance', coverage: [{ documentTypeCode: 'B_INVENTORY', period: '2025' }] }],
  ]) assert.equal(evaluate(data(), files).dataReady, false);
});

test('only the three approved output-evidence alternatives satisfy group C', () => {
  for (const code of ['C_BUSINESS_CONTRACT', 'C_INVOICE', 'C_PURCHASE_ORDER', 'C_QUOTATION', 'C_MATERIAL_CONTRACT']) {
    const files = documents();
    files.find(file => file.id === 'output').coverage = [{ documentTypeCode: code }];
    assert.equal(evaluate(data(), files).dataReady, ['C_BUSINESS_CONTRACT', 'C_INVOICE', 'C_PURCHASE_ORDER'].includes(code));
  }
});

test('debt false is a declaration; missing debt or missing evidence for true is incomplete', () => {
  assert.equal(evaluate(data({ hasExistingDebt: false })).dataReady, true);
  assert.ok(evaluate(data({ hasExistingDebt: undefined })).missingFields.includes('hasExistingDebt'));
  assert.equal(evaluate(data({ hasExistingDebt: true })).dataReady, false);
  const files = documents();
  files.push({ id: 'debt', documentGroup: 'F', coverage: [{ documentTypeCode: 'F_DEBT_STATEMENT' }] });
  assert.equal(evaluate(data({ hasExistingDebt: true }), files).dataReady, true);
});

test('collateral applicability is explicit and title/valuation remain later-stage evidence', () => {
  assert.equal(evaluate(data({ collateral: { mode: 'PROPOSED', description: 'Synthetic asset' } })).dataReady, true);
  for (const collateral of [undefined, {}, { mode: 'UNDECIDED' }, { mode: 'PROPOSED' }]) {
    assert.equal(evaluate(data({ collateral })).dataReady, false);
  }
  const result = evaluate(data({ collateral: { mode: 'PROPOSED', description: 'Synthetic asset' } }));
  assert.equal(result.requirements.find(item => item.documentTypeCode === 'E_COLLATERAL_TITLE').state, 'LATER');
});

test('authorized submission requires named sender, authorization and current declaration', () => {
  const input = data({ representative: { mode: 'AUTHORIZED', name: 'Synthetic Sender' } });
  assert.equal(evaluate(input).dataReady, false);
  const files = documents();
  files.push({ id: 'authorization', documentGroup: 'A', coverage: [{ documentTypeCode: 'A_AUTHORIZATION' }] });
  assert.equal(evaluate(input, files).dataReady, true);
  assert.equal(evaluate(data({ representative: { mode: 'AUTHORIZED' } }), files).dataReady, false);
  for (const declaration of [undefined, { accepted: false, version: 'portal-enterprise-submission-v1' }, { accepted: true, version: 'foreign' }]) {
    assert.equal(evaluate(data({ submissionDeclaration: declaration })).dataReady, false);
  }
});

test('new fields remain partial in drafts and reject injected authority claims', () => {
  const partial = { businessScope: 'MANUFACTURING', representative: {}, submissionDeclaration: { accepted: false } };
  assert.deepEqual(foundation.validateDraftV2(partial), partial);
  for (const draft of [
    { representative: { mode: 'SIGNED_BY_BANK' } }, { representative: { mode: 'AUTHORIZED', verifiedBy: 'x' } },
    { submissionDeclaration: { accepted: 'true' } }, { submissionDeclaration: { accepted: true, actorId: 'x' } },
    { businessScope: 'UNKNOWN' },
  ]) assert.throws(() => foundation.validateDraftV2(draft), error => error.getStatus() === 400);
});

test('scope must be explicitly declared and loan type must match the approved product', () => {
  for (const input of [data({ businessScope: undefined }), data({ loanType: 'VAY_DAU_TU_TSCD' })]) assert.equal(evaluate(input).dataReady, false);
});

test('policy tampering and malformed manifests fail closed', () => {
  const modified = policy();
  modified.requirements = [];
  assert.throws(() => api.evaluateIntakeReadiness(modified, data(), documents(), { phase: 'SUBMIT', submittedAt: reference }), error => error.getStatus() === 409);
  assert.throws(() => evaluate(data(), [...documents(), documents()[0]]), error => error.getStatus() === 400);
  assert.throws(() => evaluate(data(), documents(), { phase: 'LATER' }), error => error.getStatus() === 400);
});

test('server config and readiness expose approved checklist without enabling normal submit or intake', async () => {
  const request = { id: 'r', accountId: 'owner', formVersion: 2, revision: 0, status: 'DRAFT', data: data(), documents: documents() };
  const currentPeriod = String(new Date(Date.now() + 7 * 3600000).getUTCFullYear() - 1);
  request.data.revenuePeriod = currentPeriod;
  request.documents.find(file => file.id === 'finance').coverage[0].period = currentPeriod;
  // A dependency fixture only: no DB or live HTTP is involved in this contract test.
  const service = new PortalService({ portalRequest: { findFirst: async () => structuredClone(request) } });
  const config = service.formConfig();
  assert.equal(config.canSubmit, false);
  assert.equal(config.canAccept, false);
  assert.equal(config.approvedIntakePolicy.policy.version, policy().version);
  assert.deepEqual(config.approvedIntakePolicy.policy.requirements, policy().requirements);
  const readiness = await service.readiness('r', 'owner');
  assert.equal(readiness.approvedIntakeAssessment.dataReady, true);
  assert.equal(readiness.approvedIntakeAssessment.canSubmit, false);
  const checklist = await service.checklist('r', 'owner');
  assert.equal(checklist.approvedIntakeAssessment.dataReady, true);
  assert.equal(checklist.cannotSubmit, true);
});
