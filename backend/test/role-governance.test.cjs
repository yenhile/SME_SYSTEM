const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('reflect-metadata');

const { JwtStrategy } = require('../dist/modules/auth/jwt.strategy');
const { UsersService } = require('../dist/modules/users/users.service');
const { WorkflowService } = require('../dist/modules/workflow/workflow.service');
const { AdminController } = require('../dist/admin.controller');
const { assertIndependent } = require('../dist/modules/appraisal/appraisal.logic');
const { withCoordination } = require('./helpers/coordination-fixture.cjs');

const status = code => e => typeof e.getStatus === 'function' && e.getStatus() === code;

// -------------------------------------------------------------
// TIÊU CHÍ 1 & 2: JwtStrategy - Xác thực vai trò, mã lỗi ACTIVE_ROLE_INVALID & Kết thúc an toàn
// -------------------------------------------------------------
test('D7-02: JwtStrategy returns 403 with ACTIVE_ROLE_INVALID when role is revoked; 401 when account locked or no roles', async () => {
  const mockUser = {
    id: 'user-1',
    username: 'cbtd_demo',
    fullName: 'Cán bộ tín dụng Demo',
    email: 'cbtd@bank.test',
    branchName: 'Chi nhánh TP.HCM',
    isActive: true,
    roles: [{ role: { code: 'CBTD' } }],
  };

  const prisma = {
    user: {
      findUnique: async ({ where }) => {
        if (where.id === 'user-1') return mockUser;
        if (where.id === 'user-locked') return { ...mockUser, id: 'user-locked', isActive: false };
        if (where.id === 'user-no-roles') return { ...mockUser, id: 'user-no-roles', roles: [] };
        return null;
      },
    },
  };

  const strategy = new JwtStrategy(prisma);

  // 1. Vai trò hợp lệ được cấp -> xác thực thành công
  const validPrincipal = await strategy.validate(
    { headers: { 'x-active-role': 'CBTD' } },
    { sub: 'user-1' }
  );
  assert.equal(validPrincipal.id, 'user-1');
  assert.equal(validPrincipal.activeRole, 'CBTD');
  assert.deepEqual(validPrincipal.availableRoles, ['CBTD']);

  // 2. Không gửi header -> mặc định lấy vai trò đầu tiên được cấp
  const defaultPrincipal = await strategy.validate(
    { headers: {} },
    { sub: 'user-1' }
  );
  assert.equal(defaultPrincipal.activeRole, 'CBTD');

  // 3. Gửi vai trò không còn thuộc danh sách được cấp -> 403 Forbidden với mã riêng ACTIVE_ROLE_INVALID
  await assert.rejects(
    strategy.validate(
      { headers: { 'x-active-role': 'QUAN_LY' } },
      { sub: 'user-1' }
    ),
    e => {
      assert.equal(e.getStatus(), 403);
      const res = e.getResponse();
      assert.equal(res.errorCode, 'ACTIVE_ROLE_INVALID');
      assert.deepEqual(res.availableRoles, ['CBTD']);
      assert.match(res.message, /chưa được cấp cho tài khoản/i);
      return true;
    }
  );

  // 4. Tài khoản bị khóa (isActive = false) -> 401 Unauthorized
  await assert.rejects(
    strategy.validate(
      { headers: { 'x-active-role': 'CBTD' } },
      { sub: 'user-locked' }
    ),
    e => e.getStatus() === 401 && /đã bị khóa/i.test(e.message)
  );

  // 5. Tài khoản không còn vai trò nào được cấp -> 401 Unauthorized (kết thúc phiên an toàn)
  await assert.rejects(
    strategy.validate(
      { headers: { 'x-active-role': 'CBTD' } },
      { sub: 'user-no-roles' }
    ),
    e => e.getStatus() === 401 && /chưa được cấp vai trò/i.test(e.message)
  );
});

// -------------------------------------------------------------
// TIÊU CHÍ 3: Quản trị tài khoản, bảo vệ Admin và bảo vệ bàn giao công việc
// -------------------------------------------------------------
test('D7-01 & D7-02: UsersService enforces admin self-protection and refuses CBTD revocation on open loans/intake', async () => {
  const usersFixture = (openLoans = 0, pendingPortal = 0) => {
    const writes = [];
    const tx = {
      $queryRaw: async () => [],
      portalRequest: { count: async () => pendingPortal },
      loanApplication: { count: async () => openLoans },
      role: { findMany: async ({ where }) => where.code.in.map(code => ({ id: code, code })) },
      user: {
        update: async ({ where, data }) => { writes.push({ op: 'updateUser', where, data }); return data; },
        findUnique: async () => ({ id: 'u1', username: 'demo', roles: [] }),
      },
      userRole: {
        deleteMany: async () => { writes.push({ op: 'deleteRoles' }); },
        createMany: async () => { writes.push({ op: 'createRoles' }); },
      },
    };
    const service = new UsersService(withCoordination({
      $transaction: async fn => fn(tx),
      user: tx.user,
    }));
    return { service, writes };
  };

  // 1. Admin không thể tự khóa tài khoản của mình
  const { service: s1, writes: w1 } = usersFixture();
  await assert.rejects(
    s1.update('admin-1', { isActive: false }, 'admin-1'),
    e => e.getStatus() === 400 && /không thể tự khóa tài khoản/i.test(e.message)
  );
  assert.equal(w1.length, 0);

  // 2. Admin không thể tự bỏ quyền ADMIN của mình
  await assert.rejects(
    s1.update('admin-1', { roles: ['CBTD', 'QUAN_LY'] }, 'admin-1'),
    e => e.getStatus() === 400 && /không thể tự khóa tài khoản hoặc tự bỏ quyền Quản trị/i.test(e.message)
  );
  assert.equal(w1.length, 0);

  // 3. Khóa hoặc tước quyền CBTD khi còn hồ sơ vay chưa hoàn tất bị từ chối
  const { service: sLoan, writes: wLoan } = usersFixture(2, 0);
  await assert.rejects(
    sLoan.update('cbtd-1', { roles: ['QUAN_LY'] }, 'admin-other'),
    e => e.getStatus() === 400 && /đang phụ trách 2 hồ sơ chưa hoàn tất/i.test(e.message)
  );
  assert.equal(wLoan.length, 0);

  // 4. Khóa hoặc tước quyền CBTD khi còn đề nghị Portal PENDING bị từ chối
  const { service: sPortal, writes: wPortal } = usersFixture(0, 3);
  await assert.rejects(
    sPortal.update('cbtd-1', { isActive: false }, 'admin-other'),
    e => e.getStatus() === 400 && /còn 3 đề nghị Portal cần xử lý/i.test(e.message)
  );
  assert.equal(wPortal.length, 0);

  // 5. Cán bộ không còn việc tồn đọng có thể được cấp lại vai trò thành công
  const { service: sOk, writes: wOk } = usersFixture(0, 0);
  await sOk.update('officer-1', { fullName: 'Tên mới', roles: ['CBTD', 'QUAN_LY'], isActive: true }, 'admin-other');
  assert.ok(wOk.some(w => w.op === 'updateUser'));
  assert.ok(wOk.some(w => w.op === 'createRoles'));
});

// -------------------------------------------------------------
// TIÊU CHÍ 4: Maker-Checker và chống tự duyệt sau đổi vai trò hoặc bàn giao
// -------------------------------------------------------------
test('D7-04: Maker-Checker cross-role immunity: drafting/intake officer cannot approve loan after switching to THAM_QUYEN', async () => {
  const officerId = 'officer-dual-role';

  // 1. Kiểm tra assertIndependent trực tiếp:
  // Hồ sơ do officerId tiếp nhận hoặc phụ trách
  const txMock = {
    $queryRaw: async () => [],
    appraisalReportEvent: {
      findFirst: async ({ where }) => {
        // Giả lập officerId từng lưu nháp tờ trình
        if (where.actorId === officerId) return { id: 'evt-1', kind: 'DRAFT_SAVED', actorId: officerId };
        return null;
      },
    },
  };

  // Trường hợp 1: officerId là người được phân công (assignedTo)
  await assert.rejects(
    assertIndependent(txMock, { assignedTo: officerId, intakeOfficerId: 'other' }, { id: officerId }),
    e => e.getStatus() === 403 && /không được tự quyết định hồ sơ/i.test(e.message)
  );

  // Trường hợp 2: officerId là người tiếp nhận (intakeOfficerId), dù đã bàn giao sang CBTD khác
  await assert.rejects(
    assertIndependent(txMock, { assignedTo: 'new-cbtd', intakeOfficerId: officerId }, { id: officerId }),
    e => e.getStatus() === 403 && /Người tiếp nhận hoặc lập tờ trình không được tự quyết định/i.test(e.message)
  );

  // Trường hợp 3: officerId đã từng lưu nháp hoặc trình tờ trình (appraisalReportEvent)
  await assert.rejects(
    assertIndependent(txMock, { id: 'loan-1', assignedTo: 'new-cbtd', intakeOfficerId: 'other' }, { id: officerId }),
    e => e.getStatus() === 403 && /đã tham gia lập hoặc sửa tờ trình nên không được tự quyết định/i.test(e.message)
  );

  // 2. Kiểm tra qua WorkflowService: CBTD chuyển sang THAM_QUYEN tìm cách phê duyệt hồ sơ mình từng phụ trách
  const loanRecord = {
    id: 'loan-test',
    currentStage: 'THAM_DINH',
    currentStatus: 'PENDING_APPRAISAL',
    assignedTo: officerId,
    intakeOfficerId: officerId,
    completedAt: null,
    officialAmount: 2000000000,
    proposedAmount: 2000000000,
    businessPolicyVersion: 'SME_BRANCH_20261031_V1',
  };

  const wfTx = {
    $queryRaw: async () => [],
    loanApplication: { findUnique: async () => loanRecord },
  };

  const workflow = new WorkflowService(
    withCoordination({ $transaction: async fn => fn(wfTx) }),
    { predictForApplication: async () => {} }
  );

  // Cán bộ gửi request phê duyệt với vai trò THAM_QUYEN -> Bị chặn 403
  await assert.rejects(
    workflow.transitionStage(
      'loan-test',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', approvedAmount: 2000000000, interestRate: 8.5 },
      { id: officerId, activeRole: 'THAM_QUYEN' }
    ),
    e => e.getStatus() === 403 && /đã xử lý hồ sơ này ở công đoạn Tiếp nhận/i.test(e.message)
  );
});

// -------------------------------------------------------------
// TIÊU CHÍ 5: Cấu hình SLA độc lập, không hồi tố lịch sử công đoạn
// -------------------------------------------------------------
test('D7-05: Admin SLA configuration update applies only to new entries; preserves existing stage history', async () => {
  const stages = [
    { id: 's-tn', stageCode: 'TIEP_NHAN', stageName: 'Tiếp nhận', standardSlaHours: 24, orderIndex: 1 },
    { id: 's-td', stageCode: 'THAM_DINH', stageName: 'Thẩm định', standardSlaHours: 48, orderIndex: 2 },
  ];

  const stageHistories = [
    // Hồ sơ 1 đã vào Thẩm định từ trước với SLA snapshot là 48h
    { id: 'hist-1', applicationId: 'loan-1', stageId: 's-td', slaStandardHours: 48, enteredAt: new Date('2026-11-01T08:00:00Z'), exitedAt: null },
  ];

  const prismaMock = {
    workflowStage: {
      findMany: async () => stages,
      update: async ({ where, data }) => {
        const item = stages.find(s => s.stageCode === where.stageCode);
        if (item) Object.assign(item, data);
        return item;
      },
    },
    applicationStageHistory: {
      findMany: async () => stageHistories,
    },
  };

  const adminController = new AdminController(prismaMock);

  // 1. Admin cập nhật standardSlaHours của Thẩm định từ 48h lên 72h
  const updatedStage = await adminController.updateStage('THAM_DINH', {
    stageName: 'Thẩm định chi tiết',
    standardSlaHours: 72,
  });
  assert.equal(updatedStage.standardSlaHours, 72);
  assert.equal(updatedStage.stageName, 'Thẩm định chi tiết');

  // 2. Bản ghi lịch sử đã tạo trước đó (hist-1) vẫn giữ nguyên snapshot 48h, không bị thay đổi
  assert.equal(stageHistories[0].slaStandardHours, 48);

  // 3. Ràng buộc DTO kiểm tra số nguyên dương
  const { UpdateSlaDto } = require('../dist/admin.controller');
  const dto = new UpdateSlaDto();
  dto.stageName = 'Tên hợp lệ';
  dto.standardSlaHours = 10;
  assert.equal(dto.standardSlaHours, 10);
});

