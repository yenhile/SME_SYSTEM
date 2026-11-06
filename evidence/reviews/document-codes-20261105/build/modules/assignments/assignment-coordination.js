"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COORDINATION_REASONS = void 0;
exports.assertNoCoordinationConflict = assertNoCoordinationConflict;
exports.lockCoordinationCompany = lockCoordinationCompany;
exports.assertNoCompanyConflict = assertNoCompanyConflict;
exports.obsoleteCoordination = obsoleteCoordination;
const common_1 = require("@nestjs/common");
exports.COORDINATION_REASONS = ['WORKLOAD', 'UNAVAILABLE', 'ASSIGNMENT_MISMATCH', 'CONFLICT_OF_INTEREST', 'OTHER'];
async function assertNoCoordinationConflict(tx, subject, actorId, decision = false) {
    const pending = await tx.assignmentChangeRequest.findFirst({ where: { ...subject, status: 'PENDING', reasonCode: 'CONFLICT_OF_INTEREST', ...(decision ? {} : { requestedById: actorId }) }, select: { id: true } });
    if (pending)
        throw new common_1.ForbiddenException(decision ? 'Cần giải quyết đề nghị xung đột lợi ích trước khi chốt quyết định tín dụng.' : 'Bạn đang có đề nghị xung đột lợi ích chưa giải quyết; không được ghi nghiệp vụ trên hồ sơ này.');
}
async function lockCoordinationCompany(tx, actorId, taxCode) {
    await tx.$queryRaw `SELECT pg_advisory_xact_lock(hashtext(${`sme-coordination-company:${actorId}:${taxCode}`}))::text`;
}
async function assertNoCompanyConflict(tx, actorId, taxCode) {
    await lockCoordinationCompany(tx, actorId, taxCode);
    const pending = await tx.assignmentChangeRequest.findFirst({ where: { requestedById: actorId, status: 'PENDING', reasonCode: 'CONFLICT_OF_INTEREST', OR: [{ application: { company: { taxCode } } }, { portalRequest: { data: { path: ['taxCode'], equals: taxCode } } }] }, select: { id: true } });
    if (pending)
        throw new common_1.ForbiddenException('Không được sửa Company hoặc tạo hồ sơ liên quan khi đề nghị xung đột lợi ích của bạn đang chờ xử lý.');
}
async function obsoleteCoordination(tx, subject, resolutionCode, excludeId) {
    const pending = await tx.assignmentChangeRequest.findMany({ where: { ...subject, status: 'PENDING', ...(excludeId ? { id: { not: excludeId } } : {}) } });
    for (const request of pending) {
        await tx.assignmentChangeRequest.update({ where: { id: request.id }, data: { status: 'OBSOLETE', requestVersion: { increment: 1 }, resolvedAt: new Date(), resolutionCode, decisionReason: 'Bối cảnh hồ sơ đã thay đổi; đề nghị điều phối này hết hiệu lực.' } });
        await tx.internalNotification.createMany({ data: [{ userId: request.requestedById, assignmentChangeRequestId: request.id, title: 'Đề nghị điều phối hết hiệu lực', message: 'Bối cảnh phân công hoặc hồ sơ đã thay đổi. Mở biên nhận để xem kết quả.' }] });
    }
}
//# sourceMappingURL=assignment-coordination.js.map