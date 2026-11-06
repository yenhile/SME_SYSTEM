"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentPayloadHash = void 0;
exports.validateAssignmentOperation = validateAssignmentOperation;
exports.assignmentReason = assignmentReason;
exports.assertAssignmentVersion = assertAssignmentVersion;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
function validateAssignmentOperation(body) {
    if (!Number.isSafeInteger(body?.expectedAssignmentVersion) || Number(body.expectedAssignmentVersion) < 0 ||
        typeof body?.clientRequestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientRequestId)) {
        throw new common_1.BadRequestException('Cần phiên bản phân công và mã thao tác hợp lệ. Vui lòng tải lại màn hình nếu đang dùng phiên bản cũ.');
    }
}
function assignmentReason(value, required = true) {
    if (value !== undefined && (typeof value !== 'string' || value.length > 2000))
        throw new common_1.BadRequestException('Lý do phân công tối đa 2.000 ký tự.');
    const reason = typeof value === 'string' ? value.trim() : '';
    if (required && !reason)
        throw new common_1.BadRequestException('Vui lòng nhập lý do điều chuyển.');
    return reason || null;
}
const assignmentPayloadHash = (parts) => (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(parts)).digest('hex');
exports.assignmentPayloadHash = assignmentPayloadHash;
function assertAssignmentVersion(actual, expected) {
    if ((actual ?? 0) !== expected)
        throw new common_1.ConflictException('Phân công đã thay đổi. Hãy tải lại, đối chiếu người phụ trách và xác nhận lại trước khi chuyển.');
}
//# sourceMappingURL=assignment-safety.js.map