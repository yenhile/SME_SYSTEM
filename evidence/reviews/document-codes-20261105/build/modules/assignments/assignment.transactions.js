"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferLoan = transferLoan;
exports.transferPortal = transferPortal;
exports.assignmentPrediction = assignmentPrediction;
const common_1 = require("@nestjs/common");
const loan_policy_1 = require("../workflow/loan-policy");
const portal_approved_policy_1 = require("../portal/portal.approved-policy");
const assignment_safety_1 = require("./assignment-safety");
const assignment_coordination_1 = require("./assignment-coordination");
const company_snapshot_1 = require("../companies/company-snapshot");
const person = { id: true, fullName: true, username: true };
const historyInclude = { fromUser: { select: person }, toUser: { select: person }, manager: { select: person } };
async function transferLoan(tx, id, body, managerId, changeRequestId) {
    (0, assignment_safety_1.validateAssignmentOperation)(body);
    const reason = (0, assignment_safety_1.assignmentReason)(body.reason);
    const payloadHash = (0, assignment_safety_1.assignmentPayloadHash)([body.newOfficerId, reason, body.expectedAssignmentVersion, ...(changeRequestId ? [changeRequestId] : [])]);
    await tx.$queryRaw `SELECT id FROM loan_applications WHERE id=${id} FOR UPDATE`;
    const loan = await tx.loanApplication.findUnique({ where: { id }, include: { company: true, assignedUser: { select: person } } });
    if (!loan)
        throw new common_1.NotFoundException('Không tìm thấy hồ sơ.');
    const prior = await tx.applicationAssignment.findUnique({ where: { applicationId_clientRequestId: { applicationId: id, clientRequestId: body.clientRequestId } }, include: historyInclude });
    if (prior) {
        if (prior.reassignedBy !== managerId || prior.payloadHash !== payloadHash)
            throw new common_1.ConflictException('Mã thao tác đã dùng cho một phân công khác.');
        return { loan: (0, company_snapshot_1.withLoanCompany)(loan), assignmentRecord: prior, updatedLoan: (0, company_snapshot_1.withLoanCompany)(loan), replayed: true };
    }
    if (loan.completedAt || loan.currentStage === 'HOAN_TAT')
        throw new common_1.BadRequestException('Hồ sơ đã kết thúc, không thể điều chuyển.');
    (0, assignment_safety_1.assertAssignmentVersion)(loan.assignmentVersion, body.expectedAssignmentVersion);
    if (body.newOfficerId === managerId)
        throw new common_1.BadRequestException('Quản lý không được tự giao hồ sơ cho chính mình.');
    if (body.newOfficerId === loan.assignedTo)
        throw new common_1.BadRequestException('Cán bộ mới trùng cán bộ đang phụ trách.');
    await (0, loan_policy_1.lockOfficer)(tx, body.newOfficerId);
    const target = await tx.user.findUnique({ where: { id: body.newOfficerId }, include: { roles: { include: { role: true } } } });
    if (!target || !target.isActive)
        throw new common_1.NotFoundException('Cán bộ nhận không tồn tại hoặc đã bị khóa.');
    if (!target.roles.some((r) => r.role.code === 'CBTD'))
        throw new common_1.BadRequestException('Cán bộ nhận phải có vai trò CBTD.');
    const now = new Date();
    const assignmentRecord = await tx.applicationAssignment.create({ data: { applicationId: id, fromUserId: loan.assignedTo, toUserId: body.newOfficerId, reassignedBy: managerId, reassignedAt: now, reason, clientRequestId: body.clientRequestId, payloadHash, ...(changeRequestId ? { assignmentChangeRequestId: changeRequestId } : {}) }, include: historyInclude });
    const updatedLoan = await tx.loanApplication.update({ where: { id }, data: { assignedTo: body.newOfficerId, assignmentVersion: { increment: 1 }, updatedAt: now }, include: { company: true, assignedUser: { select: person } } });
    await (0, assignment_coordination_1.obsoleteCoordination)(tx, { applicationId: id }, 'OWNER_CHANGED', changeRequestId);
    const notices = [{ userId: body.newOfficerId, applicationId: id, title: 'Hồ sơ vay được bàn giao', message: `Bạn được giao hồ sơ ${loan.applicationCode}. Vui lòng đối chiếu công việc đang xử lý.` }];
    if (loan.assignedTo)
        notices.push({ userId: loan.assignedTo, applicationId: null, title: 'Hồ sơ vay đã điều chuyển', message: `Hồ sơ ${loan.applicationCode} đã được chuyển sang CBTD khác.` });
    await tx.internalNotification.createMany({ data: notices });
    return { loan: (0, company_snapshot_1.withLoanCompany)(loan), assignmentRecord, updatedLoan: (0, company_snapshot_1.withLoanCompany)(updatedLoan), replayed: false };
}
async function transferPortal(tx, id, body, managerId, include = {}, changeRequestId) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['officerId', 'expectedAssignedTo', 'expectedRevision', 'expectedAssignmentVersion', 'clientRequestId', 'note'].includes(k)) || typeof body.officerId !== 'string' || !body.officerId.trim() || !Object.prototype.hasOwnProperty.call(body, 'expectedAssignedTo') || (body.expectedAssignedTo !== null && (typeof body.expectedAssignedTo !== 'string' || !body.expectedAssignedTo.trim())))
        throw new common_1.BadRequestException('Thông tin phân công không hợp lệ.');
    (0, assignment_safety_1.validateAssignmentOperation)(body);
    const note = (0, assignment_safety_1.assignmentReason)(body.note, false);
    const payloadHash = (0, assignment_safety_1.assignmentPayloadHash)([body.officerId, body.expectedAssignedTo, body.expectedRevision ?? null, body.expectedAssignmentVersion, note, ...(changeRequestId ? [changeRequestId] : [])]);
    await tx.$queryRaw `SELECT id FROM portal_requests WHERE id=${id} FOR UPDATE`;
    const r = await tx.portalRequest.findUnique({ where: { id }, include });
    if (!r || r.status === 'DRAFT')
        throw new common_1.NotFoundException('Không tìm thấy yêu cầu đã gửi.');
    const prior = await tx.portalAssignment.findUnique({ where: { requestId_clientRequestId: { requestId: id, clientRequestId: body.clientRequestId } } });
    if (prior) {
        if (prior.managerId !== managerId || prior.payloadHash !== payloadHash)
            throw new common_1.ConflictException('Mã thao tác đã dùng cho một phân công khác.');
        return { ...r, assignmentReceipt: { id: prior.id, toUserId: prior.toUserId, replayed: true } };
    }
    if (r.status === 'ACCEPTED')
        throw new common_1.ConflictException('Yêu cầu đã tiếp nhận; điều chuyển tại hồ sơ vay.');
    (0, assignment_safety_1.assertAssignmentVersion)(r.assignmentVersion, body.expectedAssignmentVersion);
    if (r.assignedTo !== body.expectedAssignedTo)
        throw new common_1.ConflictException('Phân công đã thay đổi. Vui lòng tải lại.');
    const cycle = r.formVersion === 2 && (0, portal_approved_policy_1.isApprovedIntakeVersion)(r.checklistVersion);
    if (cycle && r.revision !== body.expectedRevision)
        throw new common_1.ConflictException('Phiên bản đề nghị đã đổi; tải lại trước khi phân công.');
    if (body.officerId === managerId)
        throw new common_1.BadRequestException('Quản lý không được tự giao hồ sơ cho chính mình.');
    await (0, loan_policy_1.lockOfficer)(tx, body.officerId);
    const officer = await tx.user.findFirst({ where: { id: body.officerId, isActive: true, roles: { some: { role: { code: 'CBTD' } } } }, select: { id: true } });
    if (!officer)
        throw new common_1.BadRequestException('Cán bộ nhận phải là CBTD đang hoạt động.');
    if (r.assignedTo === body.officerId)
        return r;
    if (r.assignedTo && !note)
        throw new common_1.BadRequestException('Cần ghi lý do điều chuyển.');
    const now = new Date();
    const updated = await tx.portalRequest.update({ where: { id }, data: { status: r.status === 'RETURNED' ? 'RETURNED' : 'ASSIGNED', assignedTo: body.officerId, assignmentVersion: { increment: 1 }, assignedBy: managerId, assignedAt: now, ...(cycle ? { revision: { increment: 1 } } : {}) }, include });
    const assignment = await tx.portalAssignment.create({ data: { requestId: id, fromUserId: r.assignedTo, toUserId: body.officerId, managerId, note, assignedAt: now, clientRequestId: body.clientRequestId, payloadHash, ...(changeRequestId ? { assignmentChangeRequestId: changeRequestId } : {}) } });
    await (0, assignment_coordination_1.obsoleteCoordination)(tx, { portalRequestId: id }, 'OWNER_CHANGED', changeRequestId);
    const notices = [{ userId: body.officerId, requestId: id, title: 'Đề nghị được phân công', message: `Bạn được giao đề nghị ${r.reference}. Vui lòng kiểm tra và tiếp nhận.` }];
    if (r.assignedTo)
        notices.push({ userId: r.assignedTo, requestId: null, title: 'Đề nghị đã điều chuyển', message: `Đề nghị ${r.reference} đã được chuyển sang CBTD khác.` });
    await tx.internalNotification.createMany({ data: notices });
    return { ...updated, assignmentReceipt: { id: assignment.id, toUserId: assignment.toUserId, replayed: false } };
}
async function assignmentPrediction(service, applicationId, replayed) {
    if (replayed)
        return { status: 'NOT_REPEATED', message: 'Thao tác đã được ghi nhận trước đó; không gọi lại dự báo.' };
    try {
        const result = await service.predictForApplication(applicationId);
        return result?.unavailable ? { status: 'INCOMPATIBLE_PA1', message: result.message } : { status: 'UPDATED', message: 'Đã cập nhật dự báo nguy cơ trễ SLA.' };
    }
    catch {
        return { status: 'FAILED', message: 'Phân công đã được lưu; chưa cập nhật được dự báo nguy cơ trễ SLA.' };
    }
}
//# sourceMappingURL=assignment.transactions.js.map