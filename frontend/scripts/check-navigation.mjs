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
  ADMIN: ['users', 'settings'],
  CBTD: ['companies', 'loans'],
  QUAN_LY: ['dashboard', 'companies', 'loans', 'appraisal', 'assignments'],
  THAM_QUYEN: ['dashboard', 'companies', 'loans', 'appraisal'],
};
const ALL_TABS = nav.NAV_ITEMS.map(item => item.tab);

test('navigation contains the approved groups and labels including the SLA settings entry (TK-02)', () => {
  assert.deepEqual(nav.NAV_GROUPS.map(group => group.label), ['Tổng quan', 'Cài đặt vận hành', 'Quản lý hồ sơ', 'Hệ thống']);
  assert.deepEqual(nav.NAV_ITEMS.map(item => item.label), ['Dashboard tổng quan', 'Liên hệ cá nhân', 'Liên hệ doanh nghiệp', 'Cấu hình SLA', 'Danh sách hồ sơ', 'Thẩm định & phê duyệt', 'Quản lý vấn đề hồ sơ', 'Điều chuyển & phân công', 'Lịch sử hoạt động']);
  const sla = nav.NAV_ITEMS.find(item => item.tab === 'settings');
  assert.equal(sla.group, 'operations');
  assert.ok(!sla.unavailable);
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

test('CBTD cannot see or open the appraisal, dashboard, assignment, user and SLA pages', () => {
  for (const tab of ['appraisal', 'dashboard', 'assignments', 'users', 'settings']) {
    assert.equal(nav.canOpenTab(tab, 'CBTD'), false, tab);
    assert.ok(!nav.visibleNavItems('CBTD').some(item => item.tab === tab), tab);
  }
});

test('Thẩm quyền and Quản lý cannot reach administration, and Admin has no loan pages', () => {
  for (const role of ['THAM_QUYEN', 'QUAN_LY']) for (const tab of ['users', 'settings']) assert.equal(nav.canOpenTab(tab, role), false, `${role}:${tab}`);
  assert.equal(nav.canOpenTab('assignments', 'THAM_QUYEN'), false);
  for (const tab of ['loans', 'appraisal', 'dashboard', 'companies', 'assignments']) assert.equal(nav.canOpenTab(tab, 'ADMIN'), false, tab);
});

test('every role lands on a page it is allowed to open', () => {
  assert.equal(nav.getDefaultTab('ADMIN'), 'users');
  assert.equal(nav.getDefaultTab('CBTD'), 'loans');
  assert.equal(nav.getDefaultTab('QUAN_LY'), 'dashboard');
  assert.equal(nav.getDefaultTab('THAM_QUYEN'), 'dashboard');
  for (const role of ROLES) assert.equal(nav.canOpenTab(nav.getDefaultTab(role), role), true, role);
});

test('a forbidden page falls back to the role landing page', () => {
  assert.equal(nav.resolveTab('dashboard', 'CBTD'), 'loans');
  assert.equal(nav.resolveTab('appraisal', 'CBTD'), 'loans');
  assert.equal(nav.resolveTab('settings', 'QUAN_LY'), 'dashboard');
  assert.equal(nav.resolveTab('loans', 'ADMIN'), 'users');
  assert.equal(nav.resolveTab('loans', 'CBTD'), 'loans');
});

test('unimplemented entries stay disabled for everyone who can see them', () => {
  for (const item of nav.NAV_ITEMS.filter(item => item.unavailable)) {
    for (const role of ROLES) {
      assert.equal(nav.canOpenTab(item.tab, role), false, `${role}:${item.tab}`);
      assert.equal(nav.resolveTab(item.tab, role), nav.getDefaultTab(role));
    }
  }
});

test('appraisal view keeps only appraisal and head-office stages without mutating source records', () => {
  const loans = ['TIEP_NHAN', 'THAM_DINH', 'CAP_TREN', 'HOAN_TAT'].map(currentStage => ({ currentStage }));
  assert.deepEqual(nav.filterLoansForView(loans, 'appraisal'), [loans[1], loans[2]]);
  assert.strictEqual(nav.filterLoansForView(loans, 'all'), loans);
  assert.equal(loans.length, 4);
});
