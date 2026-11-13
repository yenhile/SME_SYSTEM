import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/navigation.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const nav = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const ROLES = ['ADMIN', 'CBTD', 'QUAN_LY', 'THAM_QUYEN'];
// Các trang mỗi vai trò mở được (không tính mục "chưa triển khai"). Khớp quyền backend và ma trận phân quyền.
const ALLOWED = {
  ADMIN: ['dashboard', 'users', 'companies', 'settings', 'rates', 'loans', 'appraisal', 'assignments', 'activity'],
  CBTD: ['dashboard', 'companies', 'loans'],
  QUAN_LY: ['dashboard', 'companies', 'loans', 'appraisal', 'assignments'],
  THAM_QUYEN: ['dashboard', 'companies', 'loans', 'appraisal'],
};
const ALL_TABS = nav.NAV_ITEMS.map(item => item.tab);

test('navigation contains the approved groups and labels including the SLA settings entry (TK-02)', () => {
  assert.deepEqual(nav.NAV_GROUPS.map(group => group.label), ['Tổng quan', 'Cài đặt vận hành', 'Quản lý hồ sơ', 'Hệ thống']);
  assert.deepEqual(nav.NAV_ITEMS.map(item => item.label), ['Dashboard tổng quan', 'Liên hệ cá nhân', 'Liên hệ doanh nghiệp', 'Cấu hình SLA', 'Khung lãi suất', 'Danh sách hồ sơ', 'Thẩm định & phê duyệt', 'Điều chuyển & phân công', 'Lịch sử hoạt động']);
  const sla = nav.NAV_ITEMS.find(item => item.tab === 'settings');
  assert.equal(sla.group, 'operations');
  assert.ok(!sla.unavailable);
});

test('no menu entry is left as not implemented; the activity log is Admin-only and the issue menu is gone', async () => {
  assert.deepEqual(nav.NAV_ITEMS.filter(item => item.unavailable).map(item => item.tab), []);
  assert.deepEqual(nav.NAV_ITEMS.find(item => item.tab === 'activity').roles, ['ADMIN']);
  assert.equal(nav.NAV_ITEMS.some(item => item.tab === 'issues'), false);
  assert.doesNotMatch(source, /'issues'/);
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /activeTab === 'activity' && <AdminActivityLog \/>/);
});

test('every menu entry declares the roles allowed to see it', () => {
  for (const item of nav.NAV_ITEMS) {
    assert.ok(Array.isArray(item.roles) && item.roles.length > 0, item.tab);
    assert.ok(item.roles.every(role => ROLES.includes(role)), item.tab);
  }
});

test('each role can open exactly its own pages and every other page is blocked', () => {
  for (const role of ROLES) {
    const open = ALL_TABS.filter(tab => nav.canOpenTab(tab, role));
    assert.deepEqual([...open].sort(), [...ALLOWED[role]].sort(), role);
    for (const tab of ALL_TABS.filter(tab => !ALLOWED[role].includes(tab))) assert.equal(nav.resolveTab(tab, role) === tab, false, `${role} must not reach ${tab}`);
  }
  assert.deepEqual(ALL_TABS.filter(tab => nav.canOpenTab(tab, null)), []);
  assert.deepEqual(ALL_TABS.filter(tab => nav.canOpenTab(tab, undefined)), []);
});

test('CBTD cannot open the appraisal, assignment, user and SLA pages', () => {
  for (const tab of ['appraisal', 'assignments', 'users', 'settings']) {
    assert.equal(nav.canOpenTab(tab, 'CBTD'), false, tab);
    assert.ok(!nav.allowedNavItems('CBTD').some(item => item.tab === tab), tab);
  }
});

test('Thẩm quyền and Quản lý cannot reach administration; Admin opens every business page in view-only mode', () => {
  for (const role of ['THAM_QUYEN', 'QUAN_LY', 'CBTD']) for (const tab of ['users', 'settings', 'rates']) assert.equal(nav.canOpenTab(tab, role), false, `${role}:${tab}`);
  assert.equal(nav.canOpenTab('assignments', 'THAM_QUYEN'), false);
  for (const tab of ['loans', 'appraisal', 'dashboard', 'companies', 'assignments']) assert.equal(nav.canOpenTab(tab, 'ADMIN'), true, tab);
});

test('screens opened by Admin hide every business action', async () => {
  const read = file => readFile(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
  const assignments = await read('AssignmentsView.tsx');
  assert.match(assignments, /const canReassign = activeRole === 'QUAN_LY'/);
  assert.match(assignments, /canReassign \? <button/);
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /view-only-banner|Chế độ chỉ xem/);
  assert.doesNotMatch(assignments, /view-only-tag/);
  const workspace = await read('AppraisalWorkspace.tsx');
  assert.match(workspace, /const canPredict = !finished && !lookup && \['THAM_QUYEN', 'QUAN_LY'\]\.includes\(activeRole \?\? ''\)/);
  assert.match(workspace, /\{canPredict && <button[^>]*onClick=\{\(\) => void rePredict\(\)\}/);
  const coordination = await read('AssignmentChangeRequestPanel.tsx');
  assert.match(coordination, /COORDINATION_VIEWERS=\['CBTD','QUAN_LY','ADMIN'\]/);
  const dashboard = await read('DashboardView.tsx');
  assert.match(dashboard, /activeRole === 'ADMIN' && <AdminDashboard/);
  const admin = await read('dashboard/AdminDashboard.tsx');
  assert.doesNotMatch(admin, /onGoToAssignments|Điều phối|CaseTable|onSelectLoan|loan-applications/);
});

test('the dashboard coordination shortcut is offered only to the role that can reassign', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /onGoToAssignments=\{activeRole === 'QUAN_LY' \? \(\) => setTab\('assignments'\) : undefined\}/);
  assert.equal(nav.canOpenTab('assignments', 'THAM_QUYEN'), false);
  for (const role of ['QUAN_LY', 'ADMIN']) assert.equal(nav.canOpenTab('assignments', role), true, role);
});

test('every role sees the whole menu; entries outside its permission are locked, not hidden', () => {
  for (const role of ROLES) {
    const menu = nav.menuItems(role);
    assert.deepEqual(menu.map(item => item.tab), ALL_TABS, role);
    for (const item of menu) {
      const expected = item.unavailable ? 'unavailable' : ALLOWED[role].includes(item.tab) ? 'open' : 'locked';
      assert.equal(item.access, expected, `${role}:${item.tab}`);
    }
  }
  assert.deepEqual(nav.menuItems(null).map(item => item.access), ALL_TABS.map(tab => nav.NAV_ITEMS.find(item => item.tab === tab).unavailable ? 'unavailable' : 'locked'));
});

test('a locked entry stays unreachable even though it is shown', () => {
  for (const item of nav.menuItems('CBTD').filter(entry => entry.access === 'locked')) {
    assert.equal(nav.canOpenTab(item.tab, 'CBTD'), false, item.tab);
    assert.equal(nav.resolveTab(item.tab, 'CBTD'), 'dashboard', item.tab);
  }
});

test('every role lands on a page it is allowed to open', () => {
  assert.equal(nav.getDefaultTab('ADMIN'), 'dashboard');
  assert.equal(nav.getDefaultTab('CBTD'), 'dashboard');
  assert.equal(nav.getDefaultTab('QUAN_LY'), 'dashboard');
  assert.equal(nav.getDefaultTab('THAM_QUYEN'), 'appraisal');
  for (const role of ROLES) assert.equal(nav.canOpenTab(nav.getDefaultTab(role), role), true, role);
});

test('a forbidden page falls back to the role landing page', () => {
  assert.equal(nav.resolveTab('dashboard', 'CBTD'), 'dashboard');
  assert.equal(nav.resolveTab('appraisal', 'CBTD'), 'dashboard');
  assert.equal(nav.resolveTab('settings', 'QUAN_LY'), 'dashboard');
  assert.equal(nav.resolveTab('loans', 'ADMIN'), 'loans');
  assert.equal(nav.resolveTab('loans', 'CBTD'), 'loans');
  assert.equal(nav.resolveTab('assignments', 'THAM_QUYEN'), 'appraisal');
});

test('unimplemented entries stay disabled for everyone who can see them', () => {
  for (const item of nav.NAV_ITEMS.filter(item => item.unavailable)) {
    for (const role of ROLES) {
      assert.equal(nav.canOpenTab(item.tab, role), false, `${role}:${item.tab}`);
      assert.equal(nav.resolveTab(item.tab, role), nav.getDefaultTab(role));
    }
  }
});

test('screen titles carry no caption line underneath', async () => {
  const files = ['DashboardView', 'LoanList', 'AppraisalQueue', 'AssignmentsView', 'CompaniesView', 'AdminView', 'AdminActivityLog', 'PortalIntakeQueue'];
  for (const name of files) {
    const source = await readFile(new URL(`../src/components/${name}.tsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /<\/h2>\s*<p[ >]/, name);
  }
});
