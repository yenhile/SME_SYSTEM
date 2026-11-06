"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.digest = exports.REPORT_FIELDS = void 0;
exports.validateReport = validateReport;
exports.reportEvidence = reportEvidence;
exports.assertIndependent = assertIndependent;
exports.assertReportDecision = assertReportDecision;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const storage_1 = require("../../common/storage");
const company_snapshot_1 = require("../companies/company-snapshot");
exports.REPORT_FIELDS = ['legalAssessment', 'businessAssessment', 'financialAssessment', 'repaymentSource', 'collateralAssessment', 'risks', 'recommendation', 'proposedConditions'];
function validateReport(value, complete = false) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !exports.REPORT_FIELDS.includes(k)))
        throw new common_1.BadRequestException('Nội dung tờ trình không hợp lệ.');
    const result = {};
    for (const field of exports.REPORT_FIELDS) {
        const v = value[field];
        if (v !== undefined && (typeof v !== 'string' || v.length > 10000))
            throw new common_1.BadRequestException(`Nội dung không hợp lệ: ${field}.`);
        if (complete && field !== 'proposedConditions' && !v?.trim())
            throw new common_1.BadRequestException('Cần hoàn tất các phần phân tích và kết luận trước khi trình.');
        result[field] = v?.trim() ?? '';
    }
    return result;
}
const digest = (value) => (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(value)).digest('hex');
exports.digest = digest;
async function reportEvidence(tx, loan) {
    await tx.$queryRaw `SELECT id FROM companies WHERE id=${loan.companyId} FOR SHARE`;
    const company = (0, company_snapshot_1.companyForLoan)(loan, await tx.company.findUnique({ where: { id: loan.companyId } }));
    const docs = await tx.document.findMany({ where: { applicationId: loan.id }, orderBy: { id: 'asc' } });
    const documents = [];
    for (const d of docs) {
        if ((0, node_path_1.basename)(d.filePath) !== d.filePath)
            throw new common_1.ConflictException('Tài liệu chưa có tệp thực để làm căn cứ tờ trình.');
        let bytes;
        try {
            bytes = await (0, promises_1.readFile)((0, node_path_1.join)((0, storage_1.uploadRoot)(), d.filePath));
        }
        catch {
            throw new common_1.ConflictException('Không đọc được tài liệu làm căn cứ tờ trình.');
        }
        if (bytes.length !== d.fileSize)
            throw new common_1.ConflictException('Tài liệu làm căn cứ đã thay đổi.');
        documents.push({ id: d.id, documentType: d.documentType, fileName: d.fileName, fileSize: d.fileSize, sha256: (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex') });
    }
    const supplements = await tx.supplementRequest.findMany({ where: { applicationId: loan.id }, orderBy: { id: 'asc' } });
    for (const request of supplements)
        for (const file of request.portalSupplement?.files ?? []) {
            if (!file.submittedAt)
                continue;
            if ((0, node_path_1.basename)(file.filePath) !== file.filePath)
                throw new common_1.ConflictException('Đường dẫn căn cứ bổ sung không hợp lệ.');
            let bytes;
            try {
                bytes = await (0, promises_1.readFile)((0, node_path_1.join)((0, storage_1.uploadRoot)(), 'supplements', file.filePath));
            }
            catch {
                throw new common_1.ConflictException('Không đọc được căn cứ bổ sung.');
            }
            if (bytes.length !== file.fileSize || (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex') !== file.sha256)
                throw new common_1.ConflictException('Căn cứ bổ sung đã thay đổi.');
        }
    return JSON.parse(JSON.stringify({ company, proposedAmount: String(loan.proposedAmount), officialAmount: String(loan.officialAmount), loanPurpose: loan.loanPurpose,
        loanType: loan.loanType, loanTermMonths: loan.loanTermMonths, documents,
        supplements: supplements.map((s) => ({ id: s.id, status: s.status, portalSupplement: s.portalSupplement, requestContent: s.requestContent, resolvedAt: s.resolvedAt })) }));
}
async function assertIndependent(tx, loan, user) {
    if (loan.assignedTo === user.id || loan.intakeOfficerId === user.id)
        throw new common_1.ForbiddenException('Người tiếp nhận hoặc lập tờ trình không được tự quyết định hồ sơ.');
    const prior = await tx.appraisalReportEvent.findFirst({ where: { report: { applicationId: loan.id }, actorId: user.id, kind: { in: ['DRAFT_SAVED', 'SUBMITTED'] } } });
    if (prior)
        throw new common_1.ForbiddenException('Bạn đã tham gia lập hoặc sửa tờ trình nên không được tự quyết định hồ sơ.');
}
async function assertReportDecision(tx, loan, user, versionId) {
    await assertIndependent(tx, loan, user);
    const report = await tx.appraisalReport.findUnique({ where: { applicationId: loan.id }, include: { versions: { orderBy: { sequence: 'desc' }, take: 1 } } });
    const version = report?.versions[0];
    if (report?.status !== 'SUBMITTED' || !version || version.id !== versionId)
        throw new common_1.ConflictException('Cần đọc và quyết định trên đúng bản tờ trình đã trình, không còn yêu cầu làm rõ.');
    if (await tx.supplementRequest.count({ where: { applicationId: loan.id, status: 'PENDING' } }))
        throw new common_1.ConflictException('Còn yêu cầu bổ sung chưa hoàn tất.');
    if ((0, exports.digest)(await reportEvidence(tx, loan)) !== version.evidenceHash)
        throw new common_1.ConflictException('Căn cứ đã thay đổi. Yêu cầu CBTD làm rõ và trình phiên bản mới.');
    return { report, version };
}
//# sourceMappingURL=appraisal.logic.js.map