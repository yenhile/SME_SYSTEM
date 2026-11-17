const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { UsersService } = require('../dist/modules/users/users.service');

const ADMIN = 'admin-1';
const bad = pattern => e => e.getStatus() === 400 && pattern.test(e.message);

function fixture({ target = { id: 'tq-1', username: 'ha.le', isActive: true, roles: ['THAM_QUYEN'] }, otherAppraisers = 1 } = {}) {
  const writes = [], locks = [], counts = [];
  const tx = {
    $queryRaw: async (strings) => { locks.push(strings.join('?')); return []; },
    portalRequest: { count: async () => 0 },
    loanApplication: { count: async () => 0 },
    role: { findMany: async ({ where }) => where.code.in.map(code => ({ id: code, code })) },
    assignmentChangeRequest: { findFirst: async () => null, findMany: async () => [] },
    user: {
      findFirst: async () => null,
      findUnique: async () => ({ ...target, fullName: target.username, phone: null, branchName: null, roles: target.roles.map(code => ({ role: { code } })) }),
      count: async ({ where }) => { counts.push(where); return otherAppraisers; },
      update: async ({ data }) => { writes.push('user'); return data; },
      create: async ({ data }) => { writes.push('create'); return { id: 'new-1', ...data, roles: data.roles.create.map(r => ({ role: { code: r.roleId } })) }; },
    },
    userRole: { deleteMany: async () => { writes.push('roles'); }, createMany: async () => {} },
    adminAuditLog: { createMany: async ({ data }) => { writes.push('log'); return { count: data.length }; } },
  };
  const db = { ...tx, $transaction: async fn => fn(tx) };
  return { service: new UsersService(db), writes, locks, counts };
}

test('R1: tạo tài khoản kiêm CBTD và Thẩm quyền bị chặn, không ghi gì', async () => {
  const { service, writes } = fixture();
  await assert.rejects(
    service.create({ username: 'moi', password: 'x', fullName: 'Mới', email: 'moi@bank.test', roles: ['CBTD', 'THAM_QUYEN'] }, ADMIN),
    bad(/không được kiêm/i));
  assert.deepEqual(writes, []);
});

test('R1: gán thêm vai trò làm phát sinh kiêm nhiệm bị chặn ở cả hai chiều', async () => {
  const fromCbtd = fixture({ target: { id: 'cb-1', username: 'mai.bui', isActive: true, roles: ['CBTD'] } });
  await assert.rejects(fromCbtd.service.update('cb-1', { roles: ['CBTD', 'THAM_QUYEN'] }, ADMIN), bad(/không được kiêm/i));
  assert.deepEqual(fromCbtd.writes, []);

  const fromAppraiser = fixture({ otherAppraisers: 5 });
  await assert.rejects(fromAppraiser.service.update('tq-1', { roles: ['THAM_QUYEN', 'CBTD'] }, ADMIN), bad(/không được kiêm/i));
  assert.deepEqual(fromAppraiser.writes, []);
});

test('R1: tài khoản đã kiêm từ trước vẫn sửa thông tin hoặc bỏ bớt một vai trò được', async () => {
  const legacy = { id: 'old-1', username: 'kiem.cu', isActive: true, roles: ['CBTD', 'THAM_QUYEN'] };
  const keep = fixture({ target: legacy, otherAppraisers: 0 });
  await keep.service.update('old-1', { fullName: 'Tên mới', roles: ['CBTD', 'THAM_QUYEN'] }, ADMIN);
  assert.ok(keep.writes.includes('user'));

  const drop = fixture({ target: legacy, otherAppraisers: 0 });
  await drop.service.update('old-1', { roles: ['CBTD'] }, ADMIN);
  assert.ok(drop.writes.includes('roles'));
});

test('R1: còn đúng 2 Thẩm quyền thì không khóa hay bỏ vai trò Thẩm quyền của một người', async () => {
  for (const change of [{ isActive: false }, { roles: ['QUAN_LY'] }]) {
    const { service, writes, locks, counts } = fixture({ otherAppraisers: 1 });
    await assert.rejects(service.update('tq-1', change, ADMIN), bad(/tối thiểu 2 Cán bộ thẩm quyền/i));
    assert.deepEqual(writes, []);
    assert.ok(locks.some(sql => sql.includes('sme-appraiser-roster')), 'khóa danh sách Thẩm quyền trước khi đếm');
    assert.deepEqual(counts[0].id, { not: 'tq-1' });
    assert.equal(counts[0].isActive, true);
  }
});

test('R1: có 3 Thẩm quyền thì khóa được một người', async () => {
  const { service, writes } = fixture({ otherAppraisers: 2 });
  await service.update('tq-1', { isActive: false }, ADMIN);
  assert.ok(writes.includes('user'));
});

test('R1: thay đổi không làm giảm số Thẩm quyền được tính thì không đếm', async () => {
  const cases = [
    [{ id: 'cb-1', username: 'nam.hoang', isActive: true, roles: ['CBTD'] }, { isActive: false }],
    [{ id: 'tq-1', username: 'ha.le', isActive: false, roles: ['THAM_QUYEN'] }, { isActive: true }],
    [{ id: 'tq-1', username: 'ha.le', isActive: true, roles: ['THAM_QUYEN'] }, { fullName: 'Lê Hà' }],
    [{ id: 'old-1', username: 'kiem.cu', isActive: true, roles: ['CBTD', 'THAM_QUYEN'] }, { isActive: false }],
  ];
  for (const [target, change] of cases) {
    const { service, counts } = fixture({ target, otherAppraisers: 0 });
    await service.update(target.id, change, ADMIN);
    assert.equal(counts.length, 0, JSON.stringify(change));
  }
});
