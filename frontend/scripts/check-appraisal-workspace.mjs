import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const load = async path => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};
const workspace = await load('../src/appraisalWorkspace.ts');
const display = await load('../src/slaDisplay.ts');

const uuid = '11111111-2222-4333-8444-555555555555';

const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(start => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastOnWhite = hex => 1.05 / (luminance(hex) + 0.05);

test('white text on the decision buttons meets 4.5:1 at rest and on hover', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  for (const selector of ['.btn-success', '.btn-success:hover', '.btn-danger', '.btn-danger:hover']) {
    const rule = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*background:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(rule, selector);
    assert.ok(contrastOnWhite(rule[1]) >= 4.5, `${selector} ${rule[1]} ${contrastOnWhite(rule[1]).toFixed(2)}:1`);
  }
});

test('the page address carries the loan reference and nothing else', () => {
  assert.equal(workspace.appraisalPath('SME-4'), '/tham-dinh/SME-4');
  assert.equal(workspace.appraisalRefFromPath('/tham-dinh/SME-4'), 'SME-4');
  assert.equal(workspace.appraisalRefFromPath('/tham-dinh/SME-4/'), 'SME-4');
  assert.equal(workspace.appraisalRefFromPath(`/tham-dinh/${uuid}`), uuid);
  assert.equal(workspace.appraisalRefFromPath('/tham-dinh/SME%2D4'), 'SME-4');
  for (const path of ['/', '/tham-dinh', '/tham-dinh/', '/portal', '/tham-dinh/a/b', '/x/tham-dinh/SME-4', '/tham-dinh/%E0%A4%A']) assert.equal(workspace.appraisalRefFromPath(path), null, path);
  assert.equal(workspace.isLoanUuid(uuid), true);
  assert.equal(workspace.isLoanUuid('SME-4'), false);
});

test('each decision option has its own readable colour', async () => {
  const css = await readFile(new URL('../src/components/appraisal-workspace.css', import.meta.url), 'utf8');
  const panel = await readFile(new URL('../src/components/AppraisalDecisionPanel.tsx', import.meta.url), 'utf8');
  const colours = {};
  for (const [option, expected] of [['approve', '#047857'], ['reject', '#b91c1c'], ['clarify', '#92400e']]) {
    const rule = css.match(new RegExp(`\\.aw-choice-${option}\\s*\\{[^}]*--choice:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(rule, option);
    assert.equal(rule[1], expected);
    assert.ok(contrastOnWhite(rule[1]) >= 4.5, `${option} ${contrastOnWhite(rule[1]).toFixed(2)}:1`);
    colours[option] = rule[1];
  }
  assert.equal(new Set(Object.values(colours)).size, 3);
  assert.match(panel, /aw-choice-\$\{value\}/);
});

const reportVersion = (sequence, content, submittedAt) => ({ id: `v${sequence}`, sequence, content, submittedAt });

test('the report opens with the proposal and numbers the remaining sections', () => {
  assert.deepEqual(workspace.REPORT_SECTIONS.map(([key]) => key), ['legalAssessment', 'businessAssessment', 'financialAssessment', 'repaymentSource', 'collateralAssessment', 'risks']);
  assert.equal(workspace.REPORT_SECTIONS.find(([key]) => key === 'collateralAssessment')[1], 'Tài sản bảo đảm');
  assert.equal(workspace.REPORT_SECTIONS.find(([key]) => key === 'recommendation'), undefined);
});

test('the form and the reader share one list of names', () => {
  const form = Object.fromEntries(workspace.REPORT_FORM_FIELDS);
  for (const [key, label] of workspace.REPORT_SECTIONS) assert.ok(form[key].startsWith(label), key);
  assert.equal(form.recommendation, workspace.REPORT_PROPOSAL_LABEL);
  assert.equal(form.proposedConditions, `${workspace.REPORT_CONDITIONS_LABEL} (nếu có)`);
  assert.equal(workspace.REPORT_FORM_FIELDS.length, 8);
});

test('only sections whose wording changed since the previous version are marked', () => {
  const first = reportVersion(1, { risks: 'Cũ', repaymentSource: 'Giống', recommendation: 'A' }, '2026-11-01T01:00:00Z');
  const second = reportVersion(2, { risks: 'Mới', repaymentSource: ' Giống ', recommendation: 'A', legalAssessment: 'Thêm' }, '2026-11-02T01:00:00Z');
  assert.deepEqual([...workspace.changedReportSections([second, first], second)].sort(), ['legalAssessment', 'risks']);
  assert.equal(workspace.changedReportSections([second, first], first).size, 0);
  assert.equal(workspace.changedReportSections([first], first).size, 0);
});

test('a resubmitted version shows the clarification it answered', () => {
  const first = reportVersion(1, {}, '2026-11-01T01:00:00Z');
  const second = reportVersion(2, {}, '2026-11-03T01:00:00Z');
  const third = reportVersion(3, {}, '2026-11-05T01:00:00Z');
  const events = [
    { kind: 'SUBMITTED', createdAt: '2026-11-01T01:00:00Z', payload: {} },
    { kind: 'CLARIFICATION_REQUESTED', createdAt: '2026-11-02T01:00:00Z', payload: { message: 'Làm rõ nguồn trả nợ' } },
    { kind: 'CLARIFICATION_REQUESTED', createdAt: '2026-11-04T01:00:00Z', payload: { message: 'Làm rõ tài sản' } },
    { kind: 'CLARIFICATION_REQUESTED', createdAt: '2026-11-06T01:00:00Z', payload: { message: 'Chưa trả lời' } },
  ];
  const versions = [third, second, first];
  assert.equal(workspace.clarificationAnswered(events, versions, second), 'Làm rõ nguồn trả nợ');
  assert.equal(workspace.clarificationAnswered(events, versions, third), 'Làm rõ tài sản');
  assert.equal(workspace.clarificationAnswered(events, versions, first), null);
  assert.equal(workspace.clarificationAnswered(undefined, versions, second), null);
});

test('the evidence state applies only to the latest version still waiting for a decision', () => {
  const latest = reportVersion(2, {}, '2026-11-02T01:00:00Z');
  const older = reportVersion(1, {}, '2026-11-01T01:00:00Z');
  const view = over => ({ status: 'SUBMITTED', versions: [latest, older], evidenceChanged: false, ...over });
  assert.equal(workspace.evidenceState(view(), latest, false), 'UNCHANGED');
  assert.equal(workspace.evidenceState(view({ evidenceChanged: true }), latest, false), 'CHANGED');
  assert.equal(workspace.evidenceState(view(), older, false), null);
  assert.equal(workspace.evidenceState(view(), latest, true), null);
  assert.equal(workspace.evidenceState(view({ status: 'CLARIFICATION_REQUIRED' }), latest, false), null);
});

test('the debt to charter capital figure is only shown when capital is known', () => {
  assert.equal(workspace.debtToEquityText({ proposedAmount: 1e9, company: { charterCapital: 2e9 } }), '0,5 lần');
  assert.equal(workspace.debtToEquityText({ proposedAmount: 1e9, company: { charterCapital: 0 } }), '—');
});

test('a loan opened for lookup keeps that mode in its address', () => {
  assert.equal(workspace.lookupAppraisalPath('SME-4'), '/tham-dinh/SME-4?xem=tra-cuu');
  assert.equal(workspace.appraisalRefFromPath('/tham-dinh/SME-4'), 'SME-4');
  assert.equal(workspace.isLookupAddress('?xem=tra-cuu'), true);
  assert.equal(workspace.isLookupAddress(''), false);
  assert.equal(workspace.isLookupAddress('?xem=khac'), false);
});

test('finished loans show their outcome instead of a report state', () => {
  const finished = status => workspace.reportStateLabel({ currentStage: 'HOAN_TAT', currentStatus: status, businessPolicyVersion: null, reportStatus: null });
  assert.equal(finished('APPROVED'), 'Đã phê duyệt');
  assert.equal(finished('REJECTED'), 'Bị từ chối');
  assert.equal(finished('CLOSED_TIMEOUT'), 'Đã đóng do quá hạn bổ sung');
  assert.equal(workspace.isLoanFinished({ currentStage: 'HOAN_TAT' }), true);
  assert.equal(workspace.isLoanFinished({ currentStage: 'THAM_DINH', completedAt: null }), false);
});

test('a finished loan has no deadline to chase', () => {
  assert.deepEqual(display.slaDeadlineCell(null, true), { text: 'Không tính SLA', detail: '', tone: 'muted' });
});

const version = id => ({ id, sequence: 1, content: {}, submittedAt: '2026-11-05T03:00:00Z' });
const loan = over => ({ id: 'l', currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL', businessPolicyVersion: 'SME_BRANCH_20261031_V1', officialAmount: 5e9, proposedAmount: 5e9, ...over });
const report = over => ({ status: 'SUBMITTED', versions: [version('v2'), version('v1')], evidenceChanged: false, makerChecker: { canClarify: true, clarifyBlockReason: null }, ...over });
const check = (loanOver, reportValue = report(), role = 'THAM_QUYEN') => workspace.appraisalActions(loan(loanOver), reportValue, role);

test('a submitted report can be approved, rejected or sent back for clarification, on the latest version', () => {
  assert.deepEqual(check({}), { canDecide: true, canApprove: true, canClarify: true, versionId: 'v2', blockReason: null });
});

test('every reason a decision is unavailable says what happens next', () => {
  const blocked = (loanOver, reportValue) => {
    const result = check(loanOver, reportValue);
    assert.equal(result.canDecide, false);
    assert.equal(result.canApprove, false);
    assert.ok(result.blockReason);
    return result;
  };
  assert.match(blocked({ currentStatus: 'SUPPLEMENT_REQUIRED' }).blockReason, /bổ sung/);
  assert.match(blocked({}, report({ status: 'CLARIFICATION_REQUIRED' })).blockReason, /làm rõ/);
  const changed = blocked({}, report({ evidenceChanged: true }));
  assert.match(changed.blockReason, /Căn cứ đã thay đổi/);
  assert.equal(changed.canClarify, true);
  assert.match(blocked({ makerCheckerRestrictions: { decisionBlocked: true, decisionBlockReason: 'Bạn đang phụ trách hồ sơ này.' } }).blockReason, /phụ trách/);
  assert.match(blocked({ coordinationRestrictions: { decisionBlocked: true } }).blockReason, /xung đột lợi ích/);
  const conflict = blocked({ coordinationRestrictions: { writeBlocked: true } });
  assert.match(conflict.blockReason, /xung đột lợi ích/);
  assert.equal(conflict.canClarify, false);
  assert.match(blocked({}, null).blockReason, /tờ trình/);
});

test('an independent authority cannot clarify when the report says so', () => {
  assert.equal(check({}, report({ makerChecker: { canClarify: false } })).canClarify, false);
  assert.equal(check({}, report({ status: 'CLARIFICATION_REQUIRED' })).canClarify, false);
});

test('a loan over the branch limit can only be rejected', () => {
  const result = check({ businessPolicyVersion: null, officialAmount: 12e9 }, null);
  assert.equal(result.canDecide, true);
  assert.equal(result.canApprove, false);
  assert.equal(result.versionId, undefined);
  assert.equal(result.canClarify, false);
  assert.equal(check({ officialAmount: 10e9 }).canApprove, true);
});

test('a finished loan and any other role get no actions', () => {
  const none = { canDecide: false, canApprove: false, canClarify: false, versionId: undefined, blockReason: null };
  assert.deepEqual(check({ currentStage: 'HOAN_TAT', currentStatus: 'APPROVED', completedAt: '2026-11-05' }), none);
  assert.deepEqual(check({}, report(), 'QUAN_LY'), none);
  assert.deepEqual(check({ currentStage: 'TIEP_NHAN', currentStatus: 'CHECKED' }), none);
});

test('labels speak business language and never show internal codes', () => {
  assert.equal(workspace.reportStateLabel(loan({ reportStatus: 'SUBMITTED' })), 'Chờ quyết định');
  assert.equal(workspace.reportStateLabel(loan({ reportStatus: 'CLARIFICATION_REQUIRED' })), 'Chờ CBTD làm rõ');
  assert.equal(workspace.reportStateLabel(loan({ reportStatus: 'SUBMITTED', currentStatus: 'SUPPLEMENT_REQUIRED' })), 'Chờ bổ sung');
  assert.equal(workspace.reportStateLabel(loan({ businessPolicyVersion: null })), 'Quy trình cũ');
  assert.equal(workspace.documentTypeLabel('TAI_CHINH'), 'Tài chính');
  assert.equal(workspace.documentTypeLabel('LA'), 'LA');
  assert.equal(workspace.loanTypeLabel('VAY_VON_LUU_DONG'), 'Vốn lưu động');
  assert.equal(workspace.riskLabel('TRUNG_BINH'), 'Trung bình');
});

test('the deadline cell states the deadline, the pause or the missing data', () => {
  const due = '2026-12-02T03:00:00.000Z';
  assert.deepEqual(display.slaDeadlineCell({ policy: 'PA1', dueAt: due, remainingHours: 32, isOverdue: false }), { text: '10:00 02/12/2026', detail: 'còn 4 ngày', tone: 'normal' });
  assert.deepEqual(display.slaDeadlineCell({ policy: 'PA1', dueAt: due, remainingHours: 0, isOverdue: true }), { text: '10:00 02/12/2026', detail: 'Quá hạn', tone: 'danger' });
  assert.deepEqual(display.slaDeadlineCell({ policy: 'PA1', dueAt: null, remainingHours: 12, waitingEnterprise: true }), { text: 'Tạm dừng', detail: 'còn 1 ngày 4 giờ', tone: 'muted' });
  assert.deepEqual(display.slaDeadlineCell(null), { text: 'Chưa có dữ liệu', detail: '', tone: 'muted' });
  assert.deepEqual(display.slaDeadlineCell({ policy: 'PA1', dueAt: null, remainingHours: 8 }), { text: 'Ngoài kỳ lịch SLA', detail: 'còn 1 ngày', tone: 'muted' });
});
