import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/adminActivity.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const activity = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const fmt = { roleName: code => ({ CBTD: 'Cán bộ tín dụng', THAM_QUYEN: 'Cán bộ thẩm quyền' }[code] ?? code), slaText: hours => `${hours / 8} ngày làm việc` };

test('the six logged actions have Vietnamese labels and match the backend list', async () => {
  assert.deepEqual(Object.keys(activity.ACTION_LABELS), ['USER_CREATED', 'USER_PROFILE_UPDATED', 'USER_LOCKED', 'USER_UNLOCKED', 'USER_ROLES_CHANGED', 'STAGE_SLA_UPDATED', 'INTEREST_RATE_BAND_CREATED']);
  const backend = await readFile(new URL('../../backend/src/admin-audit.ts', import.meta.url), 'utf8');
  for (const action of Object.keys(activity.ACTION_LABELS)) assert.match(backend, new RegExp(`'${action}'`));
});

test('the query sends only filters that are set, with page and page size', () => {
  assert.equal(activity.auditLogPath({ actorId: '', action: '', from: '', to: '' }, 1, 20), '/admin/audit-logs?page=1&pageSize=20');
  assert.equal(
    activity.auditLogPath({ actorId: 'a 1', action: 'USER_LOCKED', from: '2026-11-01', to: '2026-11-12' }, 3, 20),
    '/admin/audit-logs?actorId=a+1&action=USER_LOCKED&from=2026-11-01&to=2026-11-12&page=3&pageSize=20',
  );
});

test('each change reads as before → after in business words', () => {
  assert.deepEqual(activity.changeLines({ action: 'USER_PROFILE_UPDATED', before: { fullName: 'Hoàng Nam', phone: null }, after: { fullName: 'Hoàng Văn Nam', phone: '0901' } }, fmt),
    ['Họ tên: Hoàng Nam → Hoàng Văn Nam', 'Số điện thoại: (trống) → 0901']);
  assert.deepEqual(activity.changeLines({ action: 'USER_LOCKED', before: { isActive: true }, after: { isActive: false } }, fmt), ['Trạng thái: Hoạt động → Đã khóa']);
  assert.deepEqual(activity.changeLines({ action: 'USER_ROLES_CHANGED', before: { roles: ['CBTD'] }, after: { roles: ['CBTD', 'THAM_QUYEN'] } }, fmt),
    ['Vai trò: Cán bộ tín dụng → Cán bộ tín dụng, Cán bộ thẩm quyền']);
  assert.deepEqual(activity.changeLines({ action: 'STAGE_SLA_UPDATED', before: { standardSlaHours: 40 }, after: { standardSlaHours: 56 } }, fmt), ['Định mức SLA: 5 ngày làm việc → 7 ngày làm việc']);
  assert.deepEqual(activity.changeLines({ action: 'USER_CREATED', before: null, after: { username: 'moi.cb', fullName: 'Cán bộ mới', roles: ['CBTD'] } }, fmt),
    ['Tên đăng nhập: moi.cb', 'Họ tên: Cán bộ mới', 'Vai trò: Cán bộ tín dụng']);
});

test('the date filter cannot end before it starts', () => {
  assert.equal(activity.filterError({ actorId: '', action: '', from: '2026-11-12', to: '2026-11-01' }), 'Từ ngày phải trước hoặc bằng Đến ngày.');
  assert.equal(activity.filterError({ actorId: '', action: '', from: '2026-11-01', to: '2026-11-12' }), null);
});

test('the screen is read-only: no write call, has loading, empty, error with retry and paging', async () => {
  const view = await readFile(new URL('../src/components/AdminActivityLog.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(view, /api\.(post|put|delete)/);
  assert.match(view, /api\.get<AuditPage>\(auditLogPath\(/);
  assert.match(view, /Chưa có thao tác nào được ghi/);
  assert.match(view, /Thử lại/);
  assert.match(view, /Trang trước/);
  assert.match(view, /Trang sau/);
});

test('thêm khung lãi suất đọc được sàn, trần, ngày hiệu lực và căn cứ', () => {
  assert.equal(activity.ACTION_LABELS.INTEREST_RATE_BAND_CREATED, 'Thêm khung lãi suất');
  assert.deepEqual(activity.changeLines({ action: 'INTEREST_RATE_BAND_CREATED', before: { minRate: 6.5, maxRate: 11, effectiveFrom: '2026-10-31T17:00:00.000Z' }, after: { minRate: 7, maxRate: 12.5, effectiveFrom: '2026-11-19T17:00:00.000Z', basis: 'Số liệu mô phỏng' } }, fmt),
    ['Sàn: 6,5%/năm → 7%/năm', 'Trần: 11%/năm → 12,5%/năm', 'Hiệu lực từ: 01/11/2026 → 20/11/2026', 'Căn cứ ban hành: (trống) → Số liệu mô phỏng']);
  assert.deepEqual(activity.changeLines({ action: 'INTEREST_RATE_BAND_CREATED', before: null, after: { minRate: 7, maxRate: 12.5, effectiveFrom: '2026-11-19T17:00:00.000Z', basis: 'Số liệu mô phỏng' } }, fmt),
    ['Sàn: 7%/năm', 'Trần: 12,5%/năm', 'Hiệu lực từ: 20/11/2026', 'Căn cứ ban hành: Số liệu mô phỏng']);
});
