import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const load = async path => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const officer = await load('../src/officerCase.ts');

const USER = 'cbtd-1';
const loan = (overrides = {}) => ({
  assignedTo: USER,
  currentStage: 'TIEP_NHAN',
  currentStatus: 'RECEIVED',
  completedAt: null,
  businessPolicyVersion: 'v1',
  isDocumentComplete: false,
  officialAmount: null,
  coordinationRestrictions: { writeBlocked: false, decisionBlocked: false },
  ...overrides,
});
const access = (loanValue, report = null, user = USER) => officer.officerAccess(loanValue, report, user);
const FULL = { legalAssessment: 'a', businessAssessment: 'b', financialAssessment: 'c', repaymentSource: 'd', collateralAssessment: 'e', risks: 'f', recommendation: 'g' };
const REQUIRED = [['legalAssessment', 'Pháp lý'], ['businessAssessment', 'Kinh doanh'], ['financialAssessment', 'Tài chính'], ['repaymentSource', 'Dòng tiền'], ['collateralAssessment', 'Tài sản'], ['risks', 'Rủi ro'], ['recommendation', 'Đề xuất']];

test('the address carries only the loan reference and rejects other paths', () => {
  assert.equal(officer.officerCasePath('SME-4'), '/ho-so/SME-4');
  assert.equal(officer.officerCaseRefFromPath('/ho-so/SME-4'), 'SME-4');
  assert.equal(officer.officerCaseRefFromPath('/ho-so/SME-4/'), 'SME-4');
  assert.equal(officer.officerCaseRefFromPath('/ho-so/SME%2D4'), 'SME-4');
  for (const path of ['/', '/ho-so', '/ho-so/', '/ho-so/a/b', '/x/ho-so/SME-4', '/tham-dinh/SME-4', '/ho-so/%E0%A4%A']) assert.equal(officer.officerCaseRefFromPath(path), null, path);
});

test('an empty field and a missing field are the same draft, any other edit is a change', () => {
  assert.equal(officer.draftChanged({}, {}), false);
  assert.equal(officer.draftChanged({ risks: '' }, {}), false);
  assert.equal(officer.draftChanged({ risks: 'a', legalAssessment: 'b' }, { legalAssessment: 'b', risks: 'a' }), false);
  assert.equal(officer.draftChanged({ risks: 'a' }, {}), true);
  assert.equal(officer.draftChanged({}, { risks: 'a' }), true);
  assert.equal(officer.draftChanged({ risks: 'a ' }, { risks: 'a' }), true);
});

test('only the assigned officer edits, and only at the stages the API allows', () => {
  assert.equal(access(loan()).reception, true);
  assert.equal(access(loan()).canEditReport, true);
  assert.equal(access(loan({ assignedTo: 'other' })).owner, false);
  assert.equal(access(loan({ assignedTo: 'other' })).reception, false);
  assert.equal(access(loan({ assignedTo: 'other' })).canEditReport, false);
  assert.equal(access(loan({ currentStage: 'THAM_DINH' }), { status: 'SUBMITTED' }).reception, false);
  assert.equal(access(loan({ currentStage: 'THAM_DINH' }), { status: 'SUBMITTED' }).canEditReport, false);
  assert.equal(access(loan({ currentStage: 'THAM_DINH' }), { status: 'CLARIFICATION_REQUIRED' }).canEditReport, true);
  assert.equal(access(loan({ currentStage: 'THAM_DINH' }), { status: 'CLARIFICATION_REQUIRED' }).reception, false);
  assert.equal(access(loan({ businessPolicyVersion: null })).canEditReport, false);
});

test('a pending conflict of interest and a finished case block every write', () => {
  const blocked = access(loan({ coordinationRestrictions: { writeBlocked: true, decisionBlocked: false } }));
  assert.equal(blocked.reception, false);
  assert.equal(blocked.canEditReport, false);
  for (const finished of [{ currentStage: 'HOAN_TAT' }, { completedAt: '2026-11-06T00:00:00Z' }, { currentStatus: 'REJECTED' }, { currentStatus: 'CLOSED_TIMEOUT' }]) {
    const value = access(loan(finished));
    assert.equal(value.finished, true);
    assert.equal(value.reception, false);
    assert.equal(value.canEditReport, false);
  }
});

test('each situation tells the officer what is happening', () => {
  const kind = (value, report = null) => officer.officerSituation(value, report, access(value, report)).kind;
  assert.equal(kind(loan()), 'steps');
  assert.equal(kind(loan({ businessPolicyVersion: null })), 'steps');
  assert.equal(kind(loan({ currentStatus: 'APPROVED', currentStage: 'HOAN_TAT' })), 'finished');
  assert.equal(kind(loan({ coordinationRestrictions: { writeBlocked: true, decisionBlocked: false } })), 'blocked');
  assert.equal(kind(loan({ assignedTo: 'other' })), 'notOwner');
  assert.equal(kind(loan({ currentStatus: 'SUPPLEMENT_REQUIRED' })), 'waitingSupplement');
  assert.equal(kind(loan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' }), { status: 'CLARIFICATION_REQUIRED' }), 'clarification');
  assert.equal(kind(loan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' }), { status: 'SUBMITTED' }), 'submitted');
  assert.equal(kind(loan({ currentStage: 'THAM_DINH', currentStatus: 'SUPPLEMENT_REQUIRED' }), { status: 'SUBMITTED' }), 'waitingSupplement');
  assert.equal(kind(loan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL', businessPolicyVersion: null })), 'submitted');
});

test('a finished case outranks a pending conflict of interest', () => {
  const value = loan({ currentStatus: 'APPROVED', currentStage: 'HOAN_TAT', coordinationRestrictions: { writeBlocked: true, decisionBlocked: false } });
  assert.equal(officer.officerSituation(value, null, access(value)).kind, 'finished');
});

test('reception steps follow the order the API requires', () => {
  const steps = value => officer.officerSteps(value, true).map(step => [step.key, step.done]);
  assert.deepEqual(steps(loan()), [['documents', false], ['amount', false], ['report', false]]);
  assert.deepEqual(steps(loan({ isDocumentComplete: true, currentStatus: 'CHECKED' })), [['documents', true], ['amount', false], ['report', false]]);
  assert.deepEqual(steps(loan({ isDocumentComplete: true, currentStatus: 'CHECKED', officialAmount: 5 })), [['documents', true], ['amount', true], ['report', false]]);
  assert.equal(officer.officerSteps(loan({ officialAmount: 5 }), false).find(step => step.key === 'amount').done, false, 'a saved amount that breaks the rules is not done');
  assert.deepEqual(steps(loan({ businessPolicyVersion: null, isDocumentComplete: true, currentStatus: 'CHECKED' })), [['documents', true], ['amount', false], ['transition', false]]);
});

test('submitting is blocked with the first reason the API would give', () => {
  const reason = (value, content = FULL, dirty = false, report = { status: 'DRAFT' }) => officer.submitBlockReason({ loan: value, report, content, dirty, required: REQUIRED });
  const ready = loan({ isDocumentComplete: true, currentStatus: 'CHECKED', officialAmount: 5 });
  assert.equal(reason(ready), null);
  assert.match(reason(ready, FULL, true), /lưu nháp/);
  assert.match(reason(ready, FULL, false, null), /lưu nháp/);
  assert.match(reason(loan({ currentStatus: 'SUPPLEMENT_REQUIRED', isDocumentComplete: true, officialAmount: 5 })), /bổ sung/);
  assert.match(reason(loan({ officialAmount: 5 })), /đủ hồ sơ/);
  assert.match(reason(loan({ isDocumentComplete: true, currentStatus: 'CHECKED' })), /hạn mức/);
  const missing = reason(ready, { ...FULL, risks: '  ', recommendation: '' });
  assert.match(missing, /Rủi ro/);
  assert.match(missing, /Đề xuất/);
  assert.doesNotMatch(missing, /Pháp lý/);
});

test('a clarification at appraisal does not ask for the reception steps again', () => {
  const value = loan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL', isDocumentComplete: false, officialAmount: 5 });
  assert.equal(officer.submitBlockReason({ loan: value, report: { status: 'CLARIFICATION_REQUIRED' }, content: FULL, dirty: false, required: REQUIRED }), null);
});

test('the officer page never offers credit decisions or the re-run of the forecast', async () => {
  const page = await read('../src/components/OfficerCaseWorkspace.tsx');
  assert.doesNotMatch(page, /prediction\/predict/);
  assert.doesNotMatch(page, /AppraisalDecisionPanel/);
  assert.doesNotMatch(page, /targetStatus:\s*'(APPROVED|REJECTED)'/);
  assert.match(page, /không phải đánh giá tín dụng/);
});

test('the report editor keeps unsaved text when the case reloads', async () => {
  const editor = await read('../src/components/OfficerReportEditor.tsx');
  assert.doesNotMatch(editor, /api\.get/, 'the editor must not refetch and reset itself');
  assert.match(editor, /draftChanged/);
  assert.match(editor, /onDirtyChange/);
});

test('a failed background reload keeps the page and what is being typed', async () => {
  const page = await read('../src/components/OfficerCaseWorkspace.tsx');
  assert.match(page, /setRefreshError/);
  assert.match(page, /beforeunload/);
});

test('only the officer leaves the popup; the manager keeps it and the authority view stays', async () => {
  const app = await read('../src/App.tsx');
  assert.match(app, /<OfficerCaseWorkspace/);
  assert.match(app, /<LoanDetailModal/);
  assert.match(app, /<AppraisalWorkspace/);
  assert.match(app, /activeRole === 'CBTD'/);
});

test('leaving a list open behind the case keeps its filters and page', async () => {
  const app = await read('../src/App.tsx');
  assert.match(app, /hidden=\{Boolean\(caseRef\)\}/);
});

test('an expired supplement never reads as still waiting', async () => {
  const tabs = await read('../src/components/AppraisalEvidenceTabs.tsx');
  assert.match(tabs, /'Đã hết hạn'/);
});
