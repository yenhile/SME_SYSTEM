import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/navigation.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const nav = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('navigation contains the approved groups and labels without an SLA settings entry', () => {
  assert.deepEqual(nav.NAV_GROUPS.map(group => group.label), ['Tổng quan', 'Cài đặt vận hành', 'Quản lý hồ sơ', 'Hệ thống']);
  assert.deepEqual(nav.NAV_ITEMS.map(item => item.label), ['Dashboard tổng quan', 'Liên hệ cá nhân', 'Liên hệ doanh nghiệp', 'Danh sách hồ sơ', 'Thẩm định & phê duyệt', 'Quản lý vấn đề hồ sơ', 'Điều chuyển & phân công', 'Lịch sử hoạt động']);
  assert.ok(nav.NAV_ITEMS.every(item => item.tab !== 'settings'));
});

test('all implemented entries open without a role requirement and share the same landing page', () => {
  assert.ok(nav.NAV_ITEMS.every(item => !('roles' in item)));
  const enabled = nav.NAV_ITEMS.filter(item => nav.canOpenTab(item.tab)).map(item => item.tab);
  assert.deepEqual(enabled, ['dashboard', 'users', 'companies', 'loans', 'appraisal', 'assignments']);
  assert.equal(nav.getDefaultTab(), 'dashboard');
  for (const tab of enabled) assert.equal(nav.resolveTab(tab), tab);
});

test('unimplemented entries are disabled for everyone rather than restricted by role', () => {
  for (const item of nav.NAV_ITEMS.filter(item => item.unavailable)) {
    assert.equal(nav.canOpenTab(item.tab), false);
    assert.equal(nav.resolveTab(item.tab), 'dashboard');
  }
});

test('appraisal view keeps only appraisal and head-office stages without mutating source records', () => {
  const loans = ['TIEP_NHAN', 'THAM_DINH', 'CAP_TREN', 'HOAN_TAT'].map(currentStage => ({ currentStage }));
  assert.deepEqual(nav.filterLoansForView(loans, 'appraisal'), [loans[1], loans[2]]);
  assert.strictEqual(nav.filterLoansForView(loans, 'all'), loans);
  assert.equal(loans.length, 4);
});
