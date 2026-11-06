import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const transpile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const toDataUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const slaUrl = toDataUrl(await transpile('../src/slaDisplay.ts'));
const queue = await import(toDataUrl((await transpile('../src/appraisalQueue.ts')).replace("'./slaDisplay'", `'${slaUrl}'`)));
const appraisalUrl = toDataUrl(await transpile('../src/appraisalWorkspace.ts'));
const display = await import(toDataUrl((await transpile('../src/loanListDisplay.ts')).replace("'./slaDisplay'", `'${slaUrl}'`).replace("'./appraisalWorkspace'", `'${appraisalUrl}'`)));

const counts = over => ({ DECIDE: 0, CBTD: 0, ENTERPRISE: 0, OTHER_REVIEWER: 0, ...over });

test('three tabs are always shown, the decision tab first', () => {
  assert.deepEqual(queue.visibleQueueTabs(counts()).map(tab => [tab.group, tab.label, tab.count]), [['DECIDE', 'Chờ quyết định', 0], ['CBTD', 'Chờ CBTD', 0], ['ENTERPRISE', 'Chờ doanh nghiệp', 0]]);
});

test('the tab for another authority appears only when it has loans', () => {
  const tabs = queue.visibleQueueTabs(counts({ OTHER_REVIEWER: 2, DECIDE: 1 }));
  assert.deepEqual(tabs.at(-1), { group: 'OTHER_REVIEWER', label: 'Thẩm quyền khác xử lý', count: 2 });
  assert.equal(tabs[0].count, 1);
});

test('an active tab that has disappeared falls back to the decision tab', () => {
  assert.equal(queue.resolveQueueTab('OTHER_REVIEWER', counts()), 'DECIDE');
  assert.equal(queue.resolveQueueTab('OTHER_REVIEWER', counts({ OTHER_REVIEWER: 1 })), 'OTHER_REVIEWER');
  assert.equal(queue.resolveQueueTab('CBTD', counts()), 'CBTD');
  assert.equal(queue.resolveQueueTab('CBTD', null), 'CBTD');
});

test('every reason reads as a business sentence and never exposes a code', () => {
  for (const reason of ['SUBMITTED', 'LEGACY', 'CLARIFICATION', 'EVIDENCE_CHANGED', 'NO_REPORT', 'CONFLICT', 'SUPPLEMENT', 'NOT_INDEPENDENT']) {
    const label = queue.queueReasonLabel(reason);
    assert.ok(label.length > 0, reason);
    assert.doesNotMatch(label, /[A-Z]{2,}_|^[A-Z_]+$/, reason);
  }
  assert.equal(queue.queueReasonLabel('LEGACY'), 'Quy trình cũ, không có tờ trình');
  assert.equal(queue.queueReasonLabel('EVIDENCE_CHANGED'), 'Căn cứ đã đổi, cần trình lại');
  assert.equal(queue.queueReasonLabel(undefined), '');
});

test('the report cell shows the version and when it was submitted', () => {
  assert.deepEqual(queue.queueReportLines({ reportVersion: { sequence: 2, submittedAt: '2026-11-05T10:33:00.000Z' }, queueReason: 'SUBMITTED' }), { title: 'Phiên bản 2', time: '17:33 05/11/2026', note: 'Chờ quyết định' });
  assert.deepEqual(queue.queueReportLines({ reportVersion: null, queueReason: 'LEGACY' }), { title: 'Không có tờ trình', time: '', note: 'Quy trình cũ, không có tờ trình' });
});

test('only the authority reviews from the queue; the manager just looks', () => {
  assert.equal(queue.queueActionLabel('THAM_QUYEN', 'DECIDE'), 'Xem xét');
  assert.equal(queue.queueActionLabel('THAM_QUYEN', 'CBTD'), 'Xem');
  assert.equal(queue.queueActionLabel('QUAN_LY', 'DECIDE'), 'Xem');
});

test('the lookup row names the outcome, who decided and when', () => {
  const finished = { currentStage: 'HOAN_TAT', currentStatus: 'APPROVED', completedAt: '2026-11-04T03:00:00.000Z', approvedAmount: '3500000000', interestRate: '8.5', stageHistories: [{ stage: { stageCode: 'HOAN_TAT' }, handler: { fullName: 'Trần Duyệt' } }] };
  assert.deepEqual(queue.lookupDecision(finished), { by: 'Trần Duyệt', time: '10:00 04/11/2026' });
  assert.deepEqual(queue.lookupDecision({ ...finished, stageHistories: [] }), { by: 'Chưa ghi nhận', time: '10:00 04/11/2026' });
  assert.deepEqual(queue.lookupDecision({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL', stageHistories: [] }), { by: '—', time: '' });
});

test('the query can carry a tab or a sort next to the filters', () => {
  assert.equal(display.loanListQuery({ ...display.EMPTY_LOAN_FILTERS, code: 'SME-1' }, 1, { queue: 'CBTD' }), 'page=1&pageSize=20&code=SME-1&queue=CBTD');
  assert.equal(display.loanListQuery(display.EMPTY_LOAN_FILTERS, 2, { sort: 'updated' }), 'page=2&pageSize=20&sort=updated');
});

test('the two menu items no longer share one screen', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const list = await readFile(new URL('../src/components/LoanList.tsx', import.meta.url), 'utf8');
  assert.match(app, /activeTab === 'appraisal' && <AppraisalQueue/);
  assert.doesNotMatch(list, /scope/);
});
