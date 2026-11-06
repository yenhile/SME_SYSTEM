"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRANCH_LIMIT_MESSAGE = exports.BRANCH_LIMIT = exports.BRANCH_POLICY = void 0;
exports.assertBranchAmount = assertBranchAmount;
exports.assertLoanWrite = assertLoanWrite;
exports.lockOfficer = lockOfficer;
const common_1 = require("@nestjs/common");
const assignment_coordination_1 = require("../assignments/assignment-coordination");
exports.BRANCH_POLICY = 'SME_BRANCH_20261031_V1';
exports.BRANCH_LIMIT = 10_000_000_000;
exports.BRANCH_LIMIT_MESSAGE = 'Cổng này tiếp nhận đề nghị vay tối đa 10 tỷ đồng. Với nhu cầu cao hơn, vui lòng liên hệ ngân hàng để được hướng dẫn.';
function assertBranchAmount(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > exports.BRANCH_LIMIT)
        throw new common_1.BadRequestException(exports.BRANCH_LIMIT_MESSAGE);
}
async function assertLoanWrite(tx, loan, actor, receptionOnly = false) {
    if (loan.completedAt || loan.currentStage === 'HOAN_TAT')
        throw new common_1.ForbiddenException('Hồ sơ đã kết thúc, không thể chỉnh sửa.');
    if (actor.activeRole === 'CBTD' && loan.assignedTo !== actor.id)
        throw new common_1.ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
    const expected = loan.currentStage === 'TIEP_NHAN' ? 'CBTD' : 'THAM_QUYEN';
    if (actor.activeRole !== expected || (receptionOnly && loan.currentStage !== 'TIEP_NHAN'))
        throw new common_1.ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
    await (0, assignment_coordination_1.assertNoCoordinationConflict)(tx, { applicationId: loan.id }, actor.id);
}
async function lockOfficer(tx, id) {
    await tx.$queryRaw `SELECT pg_advisory_xact_lock(hashtext(${`sme-officer:${id}`}))::text`;
}
//# sourceMappingURL=loan-policy.js.map