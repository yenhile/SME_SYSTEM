import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const transpile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const toDataUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const slaUrl = toDataUrl(await transpile('../src/slaDisplay.ts'));
const appraisalUrl = toDataUrl(await transpile('../src/appraisalWorkspace.ts'));
const code = (await transpile('../src/loanListDisplay.ts')).replace("'./slaDisplay'", `'${slaUrl}'`).replace("'./appraisalWorkspace'", `'${appraisalUrl}'`);
const display = await import(toDataUrl(code));

const loan = over => ({ currentStage: 'TIEP_NHAN', currentStatus: 'RECEIVED', businessPolicyVersion: 'v1', reportStatus: null, slaSummary: null, ...over });

test('every status has its own label and colour and never exposes a code', () => {
  const expected = {
    RECEIVED: ['Mới tiếp nhận', 'blue'],
    CHECKED: ['Đã đủ hồ sơ', 'teal'],
    SUPPLEMENT_REQUIRED: ['Chờ bổ sung', 'amber'],
    PENDING_APPRAISAL: ['Đang thẩm định', 'purple'],
    APPROVED: ['Đã phê duyệt', 'green'],
    REJECTED: ['Bị từ chối', 'red'],
    CLOSED_TIMEOUT: ['Đã đóng do quá hạn', 'gray'],
  };
  for (const [status, [label, tone]] of Object.entries(expected)) assert.deepEqual(display.loanStatusView(status), { label, tone }, status);
  assert.deepEqual(display.loanStatusView('MOI'), { label: 'Không xác định', tone: 'gray' });
});

test('the progress bar fills one segment per stage reached', () => {
  assert.equal(display.stageProgress('TIEP_NHAN'), 1);
  assert.equal(display.stageProgress('THAM_DINH'), 2);
  assert.equal(display.stageProgress('HOAN_TAT'), 3);
  assert.equal(display.stageLabel('THAM_DINH'), 'Thẩm định');
});

test('the status line follows the state of the loan', () => {
  assert.equal(display.loanStatusDetail(loan({ currentStage: 'HOAN_TAT', currentStatus: 'APPROVED', approvedAmount: '3500000000', interestRate: '8.5' })).text, 'Duyệt 3.500.000.000 VNĐ, 8,5%/năm');
  assert.equal(display.loanStatusDetail(loan({ currentStage: 'HOAN_TAT', currentStatus: 'REJECTED', rejectionReasonCode: 'TC02' })).text, 'TC02 - Năng lực tài chính không đảm bảo');
  assert.equal(display.loanStatusDetail(loan({ currentStage: 'HOAN_TAT', currentStatus: 'CLOSED_TIMEOUT', rejectionReasonCode: 'TC05' })).text, 'TC05 - Quá hạn thời gian bổ sung chứng từ');
  assert.deepEqual(display.loanStatusDetail(loan({ slaSummary: { policy: 'PA1', dueAt: null, remainingHours: 40, waitingEnterprise: true } })), { text: 'SLA tạm dừng, còn 5 ngày', tone: 'muted' });
  const due = '2026-12-02T03:00:00.000Z';
  assert.deepEqual(display.loanStatusDetail(loan({ slaSummary: { policy: 'PA1', dueAt: due, remainingHours: 8, isOverdue: false } })), { text: 'Hạn 10:00 02/12/2026, còn 1 ngày', tone: 'normal' });
  assert.deepEqual(display.loanStatusDetail(loan({ slaSummary: { policy: 'PA1', dueAt: due, remainingHours: 0, isOverdue: true } })), { text: 'Hạn 10:00 02/12/2026', tone: 'danger' });
  assert.deepEqual(display.loanStatusDetail(loan()), { text: 'Chưa có dữ liệu SLA', tone: 'muted' });
});

test('the stage line says what the current stage is waiting for', () => {
  const history = { enteredAt: '2026-11-05T10:40:00.000Z', handler: { fullName: 'Nguyễn Lan', username: 'lan' } };
  assert.deepEqual(display.loanStageLine(loan({ stageHistories: [history] })), { stage: 'Tiếp nhận', time: '17:40 05/11/2026', note: 'Nguyễn Lan' });
  assert.equal(display.loanStageLine(loan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL', reportStatus: 'SUBMITTED', stageHistories: [history] })).note, 'Chờ quyết định');
  assert.equal(display.loanStageLine(loan({ currentStage: 'HOAN_TAT', currentStatus: 'APPROVED', stageHistories: [history] })).note, 'Nguyễn Lan');
  assert.deepEqual(display.loanStageLine(loan({ stageHistories: [] })), { stage: 'Tiếp nhận', time: '', note: '' });
});

test('the page summary reads like a sentence', () => {
  assert.equal(display.pageSummary({ total: 0, page: 1, pageSize: 20 }), '0 hồ sơ');
  assert.equal(display.pageSummary({ total: 45, page: 1, pageSize: 20 }), '1–20 trên 45 hồ sơ');
  assert.equal(display.pageSummary({ total: 45, page: 3, pageSize: 20 }), '41–45 trên 45 hồ sơ');
  assert.equal(display.pageCount({ total: 45, pageSize: 20 }), 3);
  assert.equal(display.pageCount({ total: 0, pageSize: 20 }), 1);
});

test('the query carries only filters that are set', () => {
  assert.equal(display.loanListQuery({ code: ' SME-1 ', company: '', stage: 'THAM_DINH', status: '', loanType: '', officer: '', overdueOnly: false }, 2), 'page=2&pageSize=20&code=SME-1&stage=THAM_DINH');
  assert.equal(display.loanListQuery({ ...display.EMPTY_LOAN_FILTERS, overdueOnly: true }, 1), 'page=1&pageSize=20&overdueOnly=true');
  assert.equal(display.hasActiveFilters(display.EMPTY_LOAN_FILTERS), false);
  assert.equal(display.hasActiveFilters({ ...display.EMPTY_LOAN_FILTERS, officer: 'Lan' }), true);
});

const autoRefresh = await import(toDataUrl(await transpile('../src/autoRefresh.ts')));

function fakeEnvironment(visibilityState = 'visible') {
  const listeners = {};
  const on = name => (event, fn) => { listeners[name + event] = fn; };
  const off = name => event => { delete listeners[name + event]; };
  return { listeners, target: { addEventListener: on('w'), removeEventListener: off('w') }, doc: { visibilityState, addEventListener: on('d'), removeEventListener: off('d') } };
}

test('the list refreshes on a timer and when the officer comes back, only while visible', t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const env = fakeEnvironment();
  let calls = 0;
  const stop = autoRefresh.startAutoRefresh({ refresh: () => { calls += 1; }, target: env.target, doc: env.doc });
  t.mock.timers.tick(60000);
  assert.equal(calls, 1);
  env.listeners.wfocus();
  assert.equal(calls, 2);
  env.listeners.dvisibilitychange();
  assert.equal(calls, 3);
  env.doc.visibilityState = 'hidden';
  t.mock.timers.tick(60000);
  env.listeners.dvisibilitychange();
  assert.equal(calls, 3);
  stop();
  env.doc.visibilityState = 'visible';
  t.mock.timers.tick(60000);
  assert.equal(calls, 3);
  assert.deepEqual(Object.keys(env.listeners), []);
});

test('the filter form has no created-date filter', async () => {
  const form = await readFile(new URL('../src/components/LoanFilters.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(form, /type="date"|Ngày tạo|createdFrom|createdTo/);
  assert.deepEqual(Object.keys(display.EMPTY_LOAN_FILTERS).filter(key => key.startsWith('created')), []);
});

test('the officer list puts the heading before the tabs and shows the priority panel only on the managed tab', async () => {
  const list = await readFile(new URL('../src/components/LoanList.tsx', import.meta.url), 'utf8');
  assert.ok(list.indexOf('Hồ sơ của tôi') < list.indexOf('portal-tabs'));
  assert.ok(list.indexOf('&& priority}') > list.indexOf('<PortalIntakeQueue'));
  assert.match(list, /panel=\{isOfficer \|\| isAuthority\}/);
  assert.match(list, /stageOptions=\{isOfficer \? \[\] : stageOptions\}/);
});


test('the authority status filter follows the chosen stage and the stage follows the chosen status', () => {
  const groups = [
    { stage: 'THAM_DINH', label: 'Thẩm định', statuses: [['PENDING_APPRAISAL', 'Đang thẩm định'], ['SUPPLEMENT_REQUIRED', 'Chờ bổ sung']] },
    { stage: 'HOAN_TAT', label: 'Hoàn tất', statuses: [['APPROVED', 'Đã phê duyệt'], ['REJECTED', 'Bị từ chối']] },
  ];
  const empty = display.EMPTY_LOAN_FILTERS;
  assert.deepEqual(display.withStatusChoice(empty, groups, 'REJECTED'), { ...empty, stage: 'HOAN_TAT', status: 'REJECTED' });
  assert.deepEqual(display.withStageChoice({ ...empty, stage: 'HOAN_TAT', status: 'REJECTED' }, groups, 'THAM_DINH'), { ...empty, stage: 'THAM_DINH', status: '' });
  assert.deepEqual(display.withStageChoice({ ...empty, stage: 'THAM_DINH', status: 'SUPPLEMENT_REQUIRED' }, groups, ''), { ...empty, stage: '', status: 'SUPPLEMENT_REQUIRED' });
  assert.equal(display.withStageChoice({ ...empty, overdueOnly: true }, groups, 'HOAN_TAT').overdueOnly, false);
  assert.equal(display.withStatusChoice({ ...empty, stage: 'HOAN_TAT', status: 'APPROVED' }, groups, '').stage, 'HOAN_TAT');
});

test('the officer list separates loans in progress from finished loans and shows the priority panel only for loans in progress', async () => {
  const list = await readFile(new URL('../src/components/LoanList.tsx', import.meta.url), 'utf8');
  assert.match(list, /isOfficer \? \{ lifecycle: officerView \}/);
  assert.match(list, /'Đang xử lý' : 'Đã kết thúc'/);
  assert.match(list, /\(!isOfficer \|\| officerView === 'active'\) && priority/);
  assert.match(list, /OFFICER_STATUSES\[officerView\]/);
});

test('the coordination form asks the server which reasons the loan allows and shows why some are hidden', async () => {
  const panel = await readFile(new URL('../src/components/AssignmentChangeRequestPanel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /capabilities\?subjectType=LOAN&subjectId=/);
  assert.match(panel, /cap\.reasonCodes\.includes\(code\)/);
  assert.match(panel, /cap\.restriction/);
});
