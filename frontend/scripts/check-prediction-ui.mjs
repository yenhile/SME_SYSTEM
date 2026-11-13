import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('CBTD sees a warnings panel fed only by the owner-scoped endpoint, and only the officer role renders it', async () => {
  const panel = await read('components/MyWarningsPanel.tsx');
  assert.match(panel, /'\/dashboard\/my-warnings'/);
  assert.doesNotMatch(panel, /early-warnings/);
  const app = await read('App.tsx');
  assert.match(app, /\{isOfficer && <MyWarningsPanel/);
});

test('every place that shows a prediction uses the shared alert wording instead of raw risk codes', async () => {
  for (const file of ['components/dashboard/DashboardKit.tsx', 'components/LoanTable.tsx', 'components/LoanDetailModal.tsx', 'components/AppraisalWorkspace.tsx', 'components/OfficerCaseWorkspace.tsx']) {
    const source = await read(file);
    assert.doesNotMatch(source, /riskLabel/, `${file} still uses the old risk label`);
    assert.match(source, /alertDisplay|predictionHeadline|mlCellView/, `${file} does not use the shared alert helpers`);
  }
});

test('dashboard row shows the SLA time left and sorts by alert severity, without model explanations on the page', async () => {
  const dashboard = (await read('components/dashboard/DashboardKit.tsx')) + (await read('components/dashboard/ManagerDashboard.tsx'));
  // Thứ tự ưu tiên được xếp ở máy chủ (comparePriority) trước khi phân trang; dòng hiện số giờ làm việc còn lại.
  assert.match(dashboard, /còn \$\{workingDurationText\(row\.slaRemainingHours\)\}/);
  assert.match(dashboard, /operationsQuery\(filters, page\)/);
  assert.doesNotMatch(dashboard, /Mô hình dự báo trễ SLA/);
  const panel = await read('components/MyWarningsPanel.tsx');
  assert.match(panel, /sort\(compareAlerts\)/);
  assert.doesNotMatch(panel, /Mô hình/);
});

test('the account menu opens real dialogs instead of disabled placeholders', async () => {
  const navbar = await read('components/Navbar.tsx');
  assert.doesNotMatch(navbar, /chưa thiết lập chức năng/);
  assert.match(navbar, /<AccountDialog kind=\{dialog\}/);
  assert.match(navbar, /onOpenAccountPage\(item\.kind\)/);
  const app = await read('App.tsx');
  assert.match(app, /\{accountPage && <AccountPage kind=\{accountPage\}/);
  const dialogs = await read('components/AccountDialogs.tsx');
  assert.doesNotMatch(dialogs, /kind === 'profile'/);
});

test('display fixes from the full UI audit stay fixed', async () => {
  const assignments = await read('components/AssignmentsView.tsx');
  assert.doesNotMatch(assignments, /0901234567/, 'a fabricated phone number must not be shown for officers without one');
  assert.match(assignments, /officer\.phone \|\| '—'/);
  const dashboard = await read('components/dashboard/DashboardKit.tsx');
  assert.match(dashboard, /onTimeSummary\(bottlenecks\)/, 'the on-time rate is shown with the cumulative figures');
  assert.match(dashboard, /const v = pa1 \?\? st;/, 'the bottleneck table shows PA1 figures first');
});
