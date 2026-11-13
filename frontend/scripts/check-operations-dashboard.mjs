import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(file) {
  const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source.replace(/^import .*$/gm, ''), { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const ops = await load('operationsDashboard.ts');
const charts = await load('dashboardCharts.ts');
const roles = await load('roleDashboards.ts');
const read = file => readFile(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
const view = await read('DashboardView.tsx');
const admin = await read('dashboard/AdminDashboard.tsx');
const manager = await read('dashboard/ManagerDashboard.tsx');
const officer = await read('dashboard/OfficerDashboard.tsx');
const approver = await read('dashboard/ApproverDashboard.tsx');
const kit = await read('dashboard/DashboardKit.tsx');
const dashboards = [admin, manager, officer, approver];

test('the queries send only the filters that are set, with server-side paging', () => {
  assert.equal(ops.operationsQuery({ stage: '', officerId: '' }, 1), '/dashboard/operations?page=1&pageSize=10');
  assert.equal(ops.operationsQuery({ stage: 'THAM_DINH', officerId: 'u 1' }, 3), '/dashboard/operations?page=3&pageSize=10&stage=THAM_DINH&officerId=u+1');
  assert.equal(roles.officerQuery(2), '/dashboard/officer?page=2&pageSize=10');
  assert.equal(roles.approverQueueQuery(1), '/loan-applications?queue=DECIDE&page=1&pageSize=10');
});

test('SLA and ML labels never turn a missing prediction into "normal"', () => {
  assert.equal(ops.mlLevelView('NONE').label, 'Chưa có dự báo');
  assert.equal(ops.mlLevelView('NONE').tone, 'gray');
  assert.equal(ops.mlLevelView('KHAN').label, 'Khẩn');
  assert.equal(ops.slaStateView('PAUSED').label, 'Tạm dừng');
  assert.equal(ops.slaStateView('OVERDUE').tone, 'red');
  assert.equal(ops.slaStateView('UNKNOWN').label, 'Chưa xác định');
});

test('an overdue case gets no prediction level: being late is a fact shown in the SLA column', () => {
  assert.deepEqual(ops.mlCellView({ slaState: 'OVERDUE', mlLevel: 'KHAN', delayProbability: 1 }), { label: 'Không xếp mức', tone: 'gray' });
  assert.deepEqual(ops.mlCellView({ slaState: 'ON_TIME', mlLevel: 'KHAN', delayProbability: 0.68 }), { label: 'Khẩn · 68%', tone: 'red' });
  assert.deepEqual(ops.mlCellView({ slaState: 'ON_TIME', mlLevel: 'NONE', delayProbability: null }), { label: 'Chưa có dự báo', tone: 'gray' });
  for (const source of [manager, kit]) assert.doesNotMatch(source, /Đã quá hạn \(không cần dự báo\)/);
  assert.match(manager, /không xếp mức dự báo/);
  assert.match(kit, /Đã quá hạn thực tế/);
});

test('"due soon" means a working-hour stage with at most 8 working hours left, never late or paused', async () => {
  const pa1 = over => ({ policy: 'PA1', netWorkHours: 30, remainingHours: 10, waitingEnterprise: false, isOverdue: false, ...over });
  assert.equal(ops.DUE_SOON_WORKING_HOURS, 8);
  assert.equal(ops.slaStateOfSummary(pa1({ remainingHours: 8 })), 'DUE_SOON');
  assert.equal(ops.slaStateOfSummary(pa1({ remainingHours: 8.5 })), 'ON_TIME');
  assert.equal(ops.slaStateOfSummary(pa1({ remainingHours: 0, isOverdue: true })), 'OVERDUE');
  assert.equal(ops.slaStateOfSummary(pa1({ remainingHours: 2, waitingEnterprise: true })), 'PAUSED');
  assert.equal(ops.slaStateOfSummary(pa1({ policy: null, remainingHours: 2 })), 'ON_TIME');
  assert.equal(ops.slaStateOfSummary(null), 'UNKNOWN');
  assert.deepEqual(ops.slaStateView('DUE_SOON'), { label: 'Sắp hết hạn', tone: 'amber' });
  for (const source of [manager, approver, kit, await read('dashboard/BacklogCharts.tsx')]) assert.doesNotMatch(source, /chờ PO chốt|chưa có ngưỡng được duyệt/);
});

test('officer results list completed cases by outcome, sorted by name rather than by volume', () => {
  const rows = charts.officerResults([
    { id: 'b', fullName: 'Trần B', created: 9, completed: 5, approved: 3, rejected: 1 },
    { id: 'a', fullName: 'Nguyễn A', created: 1, completed: 2, approved: 2, rejected: 0 },
    { id: 'c', fullName: 'Lê C', created: 4, completed: 0, approved: 0, rejected: 0 },
  ]);
  assert.deepEqual(rows.map(r => r.name), ['Nguyễn A', 'Trần B']);
  assert.deepEqual(rows[1], { id: 'b', name: 'Trần B', completed: 5, approved: 3, rejected: 1, closedTimeout: 1 });
});

test('the manager sees work by officer first; the stage chart gives way, SLA by stage stays', async () => {
  const officerChart = manager.indexOf('Hồ sơ đang phụ trách theo CBTD');
  assert.ok(officerChart > 0 && officerChart < manager.indexOf('<BacklogCharts'), 'officer chart comes first');
  assert.match(manager, /<BacklogCharts[^>]*showStageChart=\{false\}/);
  assert.match(manager, /<ChartCard wide title="Hồ sơ đang phụ trách theo CBTD"/);
  const backlog = await read('dashboard/BacklogCharts.tsx');
  assert.match(backlog, /showStageChart && <ChartCard title="Hồ sơ đang xử lý theo công đoạn"/);
  const report = await read('PeriodReport.tsx');
  assert.match(report, /showOfficers && <ChartCard wide title="Kết quả theo CBTD"/);
  assert.match(report, /<details className="card rpt-details" open=\{showOfficers\}>/);
  assert.doesNotMatch(admin, /showOfficers/);
});

test('axis ticks are whole numbers covering the largest value', () => {
  assert.deepEqual(charts.niceTicks(0), [0, 1]);
  assert.deepEqual(charts.niceTicks(6), [0, 2, 4, 6]);
  assert.deepEqual(charts.niceTicks(15), [0, 5, 10, 15]);
  const ticks = charts.niceTicks(103);
  assert.ok(ticks.at(-1) >= 103 && ticks.every(Number.isInteger));
});

test('SLA stacks keep "unknown" only when some group has it, and keep every group value', () => {
  const stack = charts.slaStack([{ onTime: 1, dueSoon: 1, overdue: 2, paused: 0, unknown: 0 }, { onTime: 3, dueSoon: 0, overdue: 0, paused: 1, unknown: 0 }]);
  assert.deepEqual(stack.series.map(s => s.key), ['overdue', 'dueSoon', 'onTime', 'paused']);
  assert.deepEqual(stack.values, [[2, 0], [1, 0], [1, 3], [0, 1]]);
  assert.equal(charts.slaStack([{ onTime: 0, dueSoon: 0, overdue: 0, paused: 0, unknown: 2 }]).series.length, 5);
});

test('axis labels wrap to two lines within the column and time labels never crowd the last one', () => {
  assert.deepEqual(charts.wrapLabel('Tiếp nhận', 12), ['Tiếp nhận']);
  assert.deepEqual(charts.wrapLabel('Quản trị viên hệ thống', 12), ['Quản trị', 'viên hệ…']);
  for (const line of charts.wrapLabel('Cán bộ thẩm quyền phê duyệt', 8)) assert.ok(line.length <= 8, line);
  assert.deepEqual(charts.tickIndexes(30, 7), [0, 7, 14, 21, 29]);
  assert.deepEqual(charts.tickIndexes(6, 1), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(charts.tickIndexes(0, 7), []);
});

test('the six-month trend fills months that have no data with zero', () => {
  const range = charts.sixMonthRange('2026-11-12');
  assert.deepEqual(range, { from: '2026-06-01', to: '2026-11-12' });
  const s = charts.monthlySeries([{ month: '2026-10', created: 10, completed: 4 }], range);
  assert.deepEqual(s.months, ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepEqual(s.created, [0, 0, 0, 0, 10, 0]);
  assert.equal(charts.monthLabel('2026-10'), 'T10/26');
  assert.equal(charts.labelStep(6, 300, 6), 1);
  assert.equal(charts.labelStep(30, 300, 5), 5);
  assert.equal(charts.labelStep(30, 900, 5, 7), 7);
  assert.equal(charts.dayLabel('2026-10-28'), '28/10');
});

test('the cumulative on-time rate prefers working-hour stages and says which basis it used', () => {
  assert.deepEqual(ops.onTimeSummary([{ totalHandled: 4, delayedCount: 1, pa1: { totalHandled: 10, delayedCount: 2 } }, { totalHandled: 0, delayedCount: 0, pa1: { totalHandled: 0, delayedCount: 0 } }]), { rate: 80, onTime: 8, total: 10, basis: 'PA1' });
  assert.deepEqual(ops.onTimeSummary([{ totalHandled: 4, delayedCount: 1, pa1: null }]), { rate: 75, onTime: 3, total: 4, basis: 'LEGACY' });
  assert.equal(ops.onTimeSummary([]).rate, null);
});

test('stage choices follow the role scope returned by the server', () => {
  assert.deepEqual(ops.stageChoices(['THAM_DINH']), [['THAM_DINH', 'Thẩm định']]);
  assert.equal(ops.stageChoices(['TIEP_NHAN', 'THAM_DINH']).length, 2);
});

test('each role gets its own dashboard reading its own endpoint', () => {
  for (const [role, component] of [['ADMIN', 'AdminDashboard'], ['QUAN_LY', 'ManagerDashboard'], ['CBTD', 'OfficerDashboard'], ['THAM_QUYEN', 'ApproverDashboard']])
    assert.match(view, new RegExp(`activeRole === '${role}' && <${component}`));
  assert.match(admin, /'\/admin\/dashboard'/);
  assert.match(manager, /operationsQuery\(filters, page\)/);
  assert.match(officer, /officerQuery\(page\)/);
  assert.match(approver, /'\/dashboard\/approver'/);
  assert.match(approver, /approverQueueQuery\(page\)/);
  assert.doesNotMatch(view + manager, /\/dashboard\/early-warnings|\/dashboard\/overview/);
});

test('Admin monitors business figures in aggregate only: no case lists, coordination or actions', () => {
  assert.match(admin, /'Tổng quan nghiệp vụ'/);assert.match(admin, /'Quản trị hệ thống'/);
  assert.match(admin, /'\/dashboard\/operations\?page=1&pageSize=1'/);
  assert.match(admin, /<PeriodReport scope="Toàn hệ thống"/);
  assert.doesNotMatch(admin, /showOfficers|CaseTable|onGoToAssignments|Điều phối|onSelectLoan|Chờ tôi|loan-applications/);
  for (const tab of ['users', 'activity', 'settings']) assert.match(admin, new RegExp(`tab: '${tab}'`));
});

test('the manager uses the same period report, with the officer table and the coordination shortcut', () => {
  assert.match(manager, /<PeriodReport scope="Toàn chi nhánh" showOfficers/);
  assert.match(manager, /onGoToAssignments &&/);
  assert.match(manager, /<BacklogCharts/);assert.match(admin, /<BacklogCharts/);
});

test('the officer sees own tasks first; the approver only opens the existing decision flow; no dashboard writes', () => {
  assert.ok(officer.indexOf('Hồ sơ tôi cần xử lý') < officer.indexOf('<ChartCard'), 'the task table comes before the charts');
  assert.match(officer, /Việc cần làm/);
  assert.equal(roles.OFFICER_TASK_LABELS.CLARIFICATION, 'Làm rõ theo yêu cầu Thẩm quyền');
  assert.ok(approver.indexOf('Hồ sơ chờ tôi phê duyệt') < approver.indexOf('<ChartCard'));
  for (const source of dashboards) assert.doesNotMatch(source, /Phê duyệt nhanh|\/approve(?!r)|\/transition|api\.post|api\.put|api\.patch/);
  assert.match(approver, /sắp quá SLA/);assert.match(approver, /data\?\.kpis\.dueSoon/);
});

test('backlog and period figures are kept apart, with no caption under the dashboard title', async () => {
  assert.match(manager, /'Vận hành hiện tại'/);assert.match(manager, /'Báo cáo theo kỳ'/);
  const report = await read('PeriodReport.tsx');
  assert.match(report, /lượt công đoạn kết thúc trong kỳ/);assert.match(report, /Tiền phê duyệt thực tế/);
  assert.match(manager, /không phải chỉ số năng suất/);
  assert.match(kit, /lượt công đoạn đã kết thúc, không phải số hồ sơ/);
  for (const source of [...dashboards, kit, view]) assert.doesNotMatch(source, /Tồn đọng tại|ROLE_SCOPE/);
});

test('every chart states its scope', async () => {
  for (const source of [...dashboards, await read('PeriodReport.tsx'), await read('dashboard/BacklogCharts.tsx')]) {
    const cards = source.match(/<ChartCard[\s\S]*?>/g) ?? [];
    assert.ok(cards.length >= 2);
    for (const card of cards) assert.match(card, /scope=/);
  }
});
