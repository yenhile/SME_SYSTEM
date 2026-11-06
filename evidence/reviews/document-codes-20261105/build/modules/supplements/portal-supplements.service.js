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
exports.PortalSupplementsService = void 0;
const assignment_coordination_1 = require("../assignments/assignment-coordination");
const storage_1 = require("../../common/storage");
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const prisma_service_1 = require("../../prisma.service");
const portal_validation_1 = require("../portal/portal.validation");
const portal_supplement_1 = require("./portal-supplement");
const sla_policy_1 = require("../workflow/sla/sla-policy");
const hash = (value) => (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(value)).digest('hex');
let PortalSupplementsService = class PortalSupplementsService {
    prisma;
    dir = (0, node_path_1.join)((0, storage_1.uploadRoot)(), 'supplements');
    constructor(prisma) {
        this.prisma = prisma;
    }
    body(body, keys) {
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !keys.includes(k)))
            throw new common_1.BadRequestException('Thông tin thao tác không hợp lệ.');
    }
    async owner(tx, requestId, accountId, applicationId) {
        const r = await tx.portalRequest.findFirst({ where: { id: requestId, accountId, status: 'ACCEPTED', ...(applicationId ? { loanId: applicationId } : {}) } });
        if (!r?.loanId)
            throw new common_1.NotFoundException('Không tìm thấy hồ sơ đã được tiếp nhận.');
        return r;
    }
    async list(requestId, accountId) {
        const r = await this.owner(this.prisma, requestId, accountId);
        return (await this.prisma.supplementRequest.findMany({ where: { applicationId: r.loanId }, orderBy: { requestedAt: 'desc' } })).map(portal_supplement_1.safeView);
    }
    async details(id) {
        const r = await this.prisma.supplementRequest.findUnique({ where: { id } });
        if (!r)
            throw new common_1.NotFoundException('Không tìm thấy yêu cầu bổ sung.');
        return (0, portal_supplement_1.safeView)(r);
    }
    async locked(tx, id, scope) {
        const initial = await tx.supplementRequest.findUnique({ where: { id } });
        if (!initial)
            throw new common_1.NotFoundException('Không tìm thấy yêu cầu bổ sung.');
        if (scope)
            await this.owner(tx, scope.requestId, scope.accountId, initial.applicationId);
        await tx.$queryRaw `SELECT id FROM loan_applications WHERE id=${initial.applicationId} FOR UPDATE`;
        await tx.$queryRaw `SELECT id FROM supplement_requests WHERE id=${id} FOR UPDATE`;
        const r = await tx.supplementRequest.findUnique({ where: { id }, include: { application: true } });
        if (!r)
            throw new common_1.NotFoundException('Không tìm thấy yêu cầu bổ sung.');
        if (scope)
            await this.owner(tx, scope.requestId, scope.accountId, r.applicationId);
        return r;
    }
    pending(r) {
        if (r.status !== 'PENDING' || r.application.completedAt || r.application.currentStage === 'HOAN_TAT')
            throw new common_1.ConflictException('Yêu cầu bổ sung đã kết thúc.');
    }
    async save(tx, r, m, id, kind, fingerprint) {
        if (m.operations.length >= 1000)
            throw new common_1.ConflictException('Yêu cầu đạt giới hạn kỹ thuật lịch sử thao tác. Liên hệ cán bộ; lịch sử được giữ nguyên.');
        m.operations.push({ id, kind, hash: fingerprint });
        m.revision++;
        const result = await tx.supplementRequest.updateMany({ where: { id: r.id, status: 'PENDING', portalSupplement: { equals: r.portalSupplement } }, data: { portalSupplement: m } });
        if (result.count !== 1)
            throw new common_1.ConflictException('Dữ liệu đã thay đổi. Vui lòng tải lại.');
        return (0, portal_supplement_1.safeView)({ ...r, portalSupplement: m });
    }
    async review(id, itemId, body, user) {
        this.body(body, ['expectedRevision', 'clientRequestId', 'accepted', 'message']);
        return this.prisma.$transaction(async (tx) => {
            const r = await this.locked(tx, id), m = (0, portal_supplement_1.metadata)(r), fingerprint = hash({ itemId, accepted: body.accepted, message: body.message });
            if (!user?.id || (user.activeRole === 'CBTD' && r.application.assignedTo !== user.id))
                throw new common_1.ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
            await (0, assignment_coordination_1.assertNoCoordinationConflict)(tx, { applicationId: r.applicationId }, user.id);
            const expectedRole = r.application.currentStage === 'TIEP_NHAN' ? 'CBTD' : 'THAM_QUYEN';
            if (user.activeRole !== expectedRole || r.application.completedAt || r.application.currentStage === 'HOAN_TAT')
                throw new common_1.ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
            if ((0, portal_supplement_1.replay)(m, body.clientRequestId, 'review', fingerprint))
                return (0, portal_supplement_1.safeView)(r);
            this.pending(r);
            (0, portal_supplement_1.revision)(m, body.expectedRevision);
            (0, portal_supplement_1.review)(m, itemId, body);
            m.events[m.events.length - 1].actorId = user.id;
            return this.save(tx, r, m, body.clientRequestId, 'review', fingerprint);
        });
    }
    async returnCorrections(id, body, user, clock = new Date()) {
        this.body(body, ['expectedRevision', 'clientRequestId']);
        return this.prisma.$transaction(async (tx) => {
            const r = await this.locked(tx, id), m = (0, portal_supplement_1.metadata)(r), fingerprint = hash({ kind: 'return' });
            if (!user?.id || (user.activeRole === 'CBTD' && r.application.assignedTo !== user.id))
                throw new common_1.ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
            await (0, assignment_coordination_1.assertNoCoordinationConflict)(tx, { applicationId: r.applicationId }, user.id);
            const expectedRole = r.application.currentStage === 'TIEP_NHAN' ? 'CBTD' : 'THAM_QUYEN';
            if (user.activeRole !== expectedRole || r.application.completedAt || r.application.currentStage === 'HOAN_TAT')
                throw new common_1.ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
            if ((0, portal_supplement_1.replay)(m, body.clientRequestId, 'return', fingerprint))
                return (0, portal_supplement_1.safeView)(r);
            this.pending(r);
            (0, portal_supplement_1.revision)(m, body.expectedRevision);
            if (m.items.some(i => i.status === 'SUBMITTED'))
                throw new common_1.ConflictException('Còn mục doanh nghiệp đã gửi chưa được kiểm tra. Hoàn tất kiểm tra trước khi gửi danh sách sửa.');
            if (!m.items.some(i => i.status === 'REPLACE_REQUIRED'))
                throw new common_1.BadRequestException('Không có mục nào cần doanh nghiệp sửa.');
            m.events.push({ type: 'RETURNED', at: clock.toISOString(), actorId: user.id });
            await (0, sla_policy_1.openStagePause)(tx, r.applicationId, clock, 'WAIT_ENTERPRISE', r.id);
            return this.save(tx, r, m, body.clientRequestId, 'return', fingerprint);
        });
    }
    async respond(requestId, accountId, id, body, clock = new Date()) {
        this.body(body, ['expectedRevision', 'clientRequestId', 'documentIds']);
        return this.prisma.$transaction(async (tx) => {
            const r = await this.locked(tx, id, { requestId, accountId }), m = (0, portal_supplement_1.metadata)(r), fingerprint = hash({ documentIds: Array.isArray(body.documentIds) ? [...body.documentIds].sort() : body.documentIds });
            if ((0, portal_supplement_1.replay)(m, body.clientRequestId, 'respond', fingerprint))
                return (0, portal_supplement_1.safeView)(r);
            this.pending(r);
            (0, portal_supplement_1.revision)(m, body.expectedRevision);
            (0, portal_supplement_1.respond)(m, body.documentIds);
            for (const fileId of body.documentIds)
                await this.fileBytes(m, m.files.find(f => f.id === fileId));
            await (0, sla_policy_1.closeStagePause)(tx, r.applicationId, clock);
            return this.save(tx, r, m, body.clientRequestId, 'respond', fingerprint);
        }, { timeout: 30000 });
    }
    async upload(requestId, accountId, id, itemId, file, body) {
        this.body(body, ['expectedRevision', 'clientUploadId', 'supersedesId']);
        if (typeof body.expectedRevision !== 'string' || !/^(0|[1-9]\d*)$/.test(body.expectedRevision))
            throw new common_1.BadRequestException('expectedRevision không hợp lệ.');
        const initial = await this.prisma.supplementRequest.findUnique({ where: { id } });
        if (!initial)
            throw new common_1.NotFoundException('Không tìm thấy yêu cầu bổ sung.');
        await this.owner(this.prisma, requestId, accountId, initial.applicationId);
        const item = (0, portal_supplement_1.metadata)(initial).items.find(i => i.id === itemId);
        if (!item)
            throw new common_1.NotFoundException('Không tìm thấy mục bổ sung.');
        const meta = await (0, portal_validation_1.validatePortalFile)(item.documentGroup, file);
        const sha256 = (0, node_crypto_1.createHash)('sha256').update(file.buffer).digest('hex');
        const fingerprint = hash({ itemId, sha256, fileName: meta.fileName, supersedesId: body.supersedesId ?? null });
        let createdPath, committed = false;
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const r = await this.locked(tx, id, { requestId, accountId }), m = (0, portal_supplement_1.metadata)(r);
                if ((0, portal_supplement_1.replay)(m, body.clientUploadId, 'upload', fingerprint))
                    return (0, portal_supplement_1.safeView)(r);
                this.pending(r);
                (0, portal_supplement_1.revision)(m, Number(body.expectedRevision));
                if (m.files.length >= 300 || m.operations.length >= 1000)
                    throw new common_1.ConflictException('Yêu cầu đạt giới hạn kỹ thuật file/lịch sử. Liên hệ cán bộ; không xóa lịch sử cũ.');
                const current = m.items.find(i => i.id === itemId);
                if (!current || !['PENDING', 'REPLACE_REQUIRED'].includes(current.status))
                    throw new common_1.ConflictException('Mục này chưa mở nhận tệp bổ sung.');
                const head = (0, portal_supplement_1.heads)(m).find(f => f.itemId === itemId);
                if ((head?.id ?? undefined) !== (body.supersedesId ?? undefined))
                    throw new common_1.ConflictException('Phải thay thế đúng phiên bản tệp hiện hành.');
                const key = (0, node_crypto_1.randomUUID)();
                await (0, promises_1.mkdir)(this.dir, { recursive: true });
                const path = (0, node_path_1.join)(this.dir, key);
                const handle = await (0, promises_1.open)(path, 'wx');
                createdPath = path;
                try {
                    await handle.writeFile(file.buffer);
                }
                finally {
                    await handle.close();
                }
                const at = new Date().toISOString();
                m.files.push({ id: key, itemId, fileName: meta.fileName, mimeType: meta.mimeType, fileSize: file.size, version: (head?.version ?? 0) + 1, ...(head ? { supersedesId: head.id } : {}), uploadedAt: at, filePath: key, sha256 });
                m.events.push({ type: 'UPLOADED', at, itemId });
                return this.save(tx, r, m, body.clientUploadId, 'upload', fingerprint);
            });
            committed = true;
            return result;
        }
        finally {
            if (createdPath && !committed)
                await (0, promises_1.unlink)(createdPath).catch(() => undefined);
        }
    }
    async download(id, fileId, scope) {
        const r = await this.prisma.supplementRequest.findUnique({ where: { id } });
        if (!r)
            throw new common_1.NotFoundException('Không tìm thấy yêu cầu bổ sung.');
        if (scope)
            await this.owner(this.prisma, scope.requestId, scope.accountId, r.applicationId);
        const m = (0, portal_supplement_1.metadata)(r), f = m.files.find(f => f.id === fileId);
        return { buffer: await this.fileBytes(m, f), fileName: f.fileName };
    }
    async fileBytes(m, f) {
        if (!f || !/^[0-9a-f-]{36}$/i.test(f.filePath) || f.filePath !== f.id)
            throw new common_1.NotFoundException('Không tìm thấy tệp.');
        let buffer;
        try {
            buffer = await (0, promises_1.readFile)((0, node_path_1.join)(this.dir, f.filePath));
        }
        catch {
            throw new common_1.ConflictException('Không đọc được tệp bổ sung.');
        }
        if (buffer.length !== f.fileSize || (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex') !== f.sha256)
            throw new common_1.ConflictException('Nội dung tệp không khớp bản đã lưu.');
        await (0, portal_validation_1.validatePortalFile)(m.items.find((i) => i.id === f.itemId).documentGroup, { buffer, originalname: f.fileName, size: buffer.length, mimetype: f.mimeType });
        return buffer;
    }
};
exports.PortalSupplementsService = PortalSupplementsService;
exports.PortalSupplementsService = PortalSupplementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PortalSupplementsService);
//# sourceMappingURL=portal-supplements.service.js.map