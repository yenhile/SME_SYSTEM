"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsService = void 0;
const storage_1 = require("../../common/storage");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const loan_policy_1 = require("../workflow/loan-policy");
let DocumentsService = class DocumentsService {
    prisma;
    uploadDir = (0, storage_1.uploadRoot)();
    constructor(prisma) {
        this.prisma = prisma;
    }
    async upload(applicationId, documentType, file, userId, activeRole = 'CBTD') {
        await (0, promises_1.mkdir)(this.uploadDir, { recursive: true });
        const key = (0, node_crypto_1.randomUUID)();
        const path = (0, node_path_1.join)(this.uploadDir, key);
        await (0, promises_1.writeFile)(path, file.buffer);
        try {
            return await this.create(applicationId, { documentType, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype, filePath: key }, userId, activeRole);
        }
        catch (err) {
            await (0, promises_1.unlink)(path);
            throw err;
        }
    }
    async download(id) {
        const document = await this.prisma.document.findUnique({ where: { id } });
        if (!document)
            throw new common_1.NotFoundException('Không tìm thấy chứng từ.');
        if ((0, node_path_1.basename)(document.filePath) !== document.filePath)
            throw new common_1.NotFoundException('Tệp chưa được tải lên hệ thống.');
        try {
            return { buffer: await (0, promises_1.readFile)((0, node_path_1.join)(this.uploadDir, document.filePath)), fileName: document.fileName };
        }
        catch {
            throw new common_1.NotFoundException('Không tìm thấy tệp đã lưu.');
        }
    }
    async create(applicationId, dto, userId, activeRole = 'CBTD') {
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM loan_applications WHERE id = ${applicationId} FOR UPDATE`;
            const loan = await tx.loanApplication.findUnique({
                where: { id: applicationId },
            });
            if (!loan) {
                throw new common_1.NotFoundException(`Không tìm thấy hồ sơ với ID: ${applicationId}`);
            }
            await (0, loan_policy_1.assertLoanWrite)(tx, loan, { id: userId, activeRole });
            const document = await tx.document.create({
                data: {
                    applicationId,
                    documentType: dto.documentType,
                    fileName: dto.fileName,
                    filePath: dto.filePath,
                    fileSize: dto.fileSize,
                    mimeType: dto.mimeType,
                    uploadedBy: userId,
                },
                include: {
                    uploader: {
                        select: { id: true, fullName: true, username: true },
                    },
                },
            });
            await this.withdrawConfirmation(tx, loan);
            return document;
        });
    }
    async withdrawConfirmation(tx, loan) {
        if (loan.currentStage !== client_1.StageCode.TIEP_NHAN || !loan.isDocumentComplete)
            return;
        await tx.loanApplication.update({
            where: { id: loan.id },
            data: {
                isDocumentComplete: false,
                ...(loan.currentStatus === client_1.LoanStatus.CHECKED ? { currentStatus: client_1.LoanStatus.RECEIVED } : {}),
                updatedAt: new Date(),
            },
        });
    }
    async findByApplication(applicationId) {
        return this.prisma.document.findMany({
            where: { applicationId },
            include: {
                uploader: {
                    select: { id: true, fullName: true, username: true },
                },
            },
            orderBy: { uploadedAt: 'desc' },
        });
    }
    async delete(id, actor) {
        const doc = await this.prisma.document.findUnique({
            where: { id },
        });
        if (!doc) {
            throw new common_1.NotFoundException(`Không tìm thấy chứng từ với ID: ${id}`);
        }
        const deleted = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM loan_applications WHERE id = ${doc.applicationId} FOR UPDATE`;
            if (!(await tx.document.findUnique({ where: { id } })))
                throw new common_1.NotFoundException(`Không tìm thấy chứng từ với ID: ${id}`);
            const loan = await tx.loanApplication.findUnique({ where: { id: doc.applicationId } });
            if (!loan)
                throw new common_1.NotFoundException('Không tìm thấy hồ sơ.');
            await (0, loan_policy_1.assertLoanWrite)(tx, loan, actor);
            if (loan.businessPolicyVersion) {
                const versions = await tx.appraisalReportVersion.findMany({ where: { report: { applicationId: loan.id } }, select: { evidence: true } });
                if (versions.some(v => (v.evidence.documents ?? []).some((d) => d.id === id)))
                    throw new common_1.BadRequestException('Tài liệu đã là căn cứ tờ trình. Giữ bản cũ và tải phiên bản mới.');
            }
            const removed = await tx.document.delete({ where: { id } });
            if (loan)
                await this.withdrawConfirmation(tx, loan);
            return removed;
        });
        if (!doc.portalDocumentId && (0, node_path_1.basename)(doc.filePath) === doc.filePath)
            await (0, promises_1.unlink)((0, node_path_1.join)(this.uploadDir, doc.filePath)).catch(() => undefined);
        return deleted;
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DocumentsService);
//# sourceMappingURL=documents.service.js.map