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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortalService = void 0;
const assignment_transactions_1 = require("../assignments/assignment.transactions");
const officer_workloads_1 = require("../assignments/officer-workloads");
const assignment_coordination_1 = require("../assignments/assignment-coordination");
const storage_1 = require("../../common/storage");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const document_codes_1 = require("../../common/document-codes");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const portal_validation_1 = require("./portal.validation");
const portal_foundation_1 = require("./portal.foundation");
const portal_policy_1 = require("./portal.policy");
const portal_snapshot_1 = require("./portal.snapshot");
const portal_readiness_1 = require("./portal.readiness");
const portal_approved_policy_1 = require("./portal.approved-policy");
const portal_tracking_1 = require("./portal.tracking");
const portal_intake_cycle_1 = require("./portal.intake-cycle");
const portal_intake_workflow_1 = require("./portal.intake-workflow");
const portal_approved_policy_2 = require("./portal.approved-policy");
const sla_policy_1 = require("../workflow/sla/sla-policy");
const company_snapshot_1 = require("../companies/company-snapshot");
const portal_intake_cycle_2 = require("./portal.intake-cycle");
const documentSelect = { id: true, documentGroup: true, fileName: true, fileSize: true, uploadedAt: true, coverage: true, version: true, supersedesId: true, withdrawnAt: true };
const officerSelect = { id: true, fullName: true, username: true };
const activeDocuments = { withdrawnAt: null, nextVersion: { is: null } };
const include = { documents: { where: activeDocuments, select: documentSelect }, account: { select: { id: true, email: true, contactName: true, phone: true } }, assignedOfficer: { select: officerSelect } };
const documentTypes = { A: client_1.DocumentType.PHAP_LY, B: client_1.DocumentType.TAI_CHINH, C: client_1.DocumentType.HOAT_DONG_SX, D: client_1.DocumentType.PHUONG_AN, E: client_1.DocumentType.TSBD, F: client_1.DocumentType.DU_NO };
const loan_policy_1 = require("../workflow/loan-policy");
let PortalService = class PortalService {
    prisma;
    policyContext;
    dir = (0, storage_1.uploadRoot)();
    constructor(prisma, policyContext) {
        this.prisma = prisma;
        this.policyContext = policyContext;
    }
    cycle() { return new portal_intake_workflow_1.PortalIntakeWorkflow(this.prisma, include, docs => this.physicalFiles(docs)); }
    usesCycle(r) { return r.formVersion === 2 && (0, portal_approved_policy_2.isApprovedIntakeVersion)(r.checklistVersion); }
    published(r) { const s = r.checklistSnapshot; return this.usesCycle(r) && s ? (0, portal_snapshot_1.readV2Snapshot)({ ...r, data: s.data, revision: s.revision, submittedAt: s.submittedAt }) : (0, portal_snapshot_1.readV2Snapshot)(r); }
    companyComparison(r, data, company) {
        const base = (0, portal_readiness_1.companyReadiness)(data, company);
        if (!this.usesCycle(r))
            return base;
        const differences = (0, portal_intake_cycle_1.approvedCompanyDifferences)(data, company);
        return { ...base, differences, compatible: differences.length === 0, message: differences.length ? 'Thông tin trọng yếu khác doanh nghiệp hiện hữu. Cần đối soát riêng, không tự ghi đè.' : base.message };
    }
    formConfig() {
        const config = { ...(0, portal_foundation_1.getFormConfig)(), rolloutEnabled: process.env.PORTAL_V2_ROLLOUT_ENABLED === 'true', branchLimit: 10000000000, supportedScopes: Object.keys(portal_approved_policy_2.SCOPE_POLICY_VERSIONS), supportedLoanTypes: ['VAY_VON_LUU_DONG'], mvpPolicy: portal_readiness_1.mvpPolicy, approvedIntakePolicy: (0, portal_approved_policy_1.describeApprovedPolicy)() };
        if ((0, portal_intake_cycle_1.intakeCycleEnabled)()) {
            const policy = process.env.PORTAL_V2_ROLLOUT_ENABLED === 'true' ? (0, portal_approved_policy_2.getPolicyForScope)('MANUFACTURING') : (0, portal_approved_policy_1.getApprovedPolicy)();
            return { ...config, canSubmit: true, canAccept: true, intakeCycleEnabled: true, submitPolicyVersion: policy.version, policyStatus: 'APPROVED', approvedIntakePolicy: { policy, canSubmit: true, canAccept: true, activationStatus: 'ENABLED', note: 'Đã mở nộp theo checklist được duyệt; ngân hàng kiểm tra nội dung trước khi tiếp nhận.' } };
        }
        try {
            const policy = (0, portal_policy_1.resolveTestPolicy)(this.policyContext);
            return { ...config, canSubmit: true, canAccept: true, submitPolicyVersion: policy.version, readinessVersion: policy.readinessVersion, policyStatus: 'TEST_ONLY' };
        }
        catch (error) {
            if (!(error instanceof common_1.ConflictException))
                throw error;
            return { ...config, canAccept: false, submitPolicyVersion: null };
        }
    }
    async checklist(id, accountId) {
        const request = await this.one(id, accountId), base = (0, portal_foundation_1.checklistFor)(request);
        if (request.formVersion !== 2 || !(0, portal_intake_cycle_1.isIntakeEditable)(request))
            return base;
        const preview = { ...base, approvedIntakeAssessment: this.approvedAssessment(request) };
        if ((0, portal_intake_cycle_1.intakeCycleEnabled)())
            return { ...preview, cannotSubmit: !preview.approvedIntakeAssessment?.dataReady, policyStatus: 'APPROVED' };
        try {
            const policy = (0, portal_policy_1.resolveTestPolicy)(this.policyContext);
            const result = (0, portal_policy_1.evaluatePolicy)(policy, request.data, request.documents, 'SUBMIT');
            return { ...preview, policyStatus: 'TEST_ONLY', cannotSubmit: result.missing.length > 0 || result.formErrors.length > 0, requirements: result.requirements, missing: result.missing, formErrors: result.formErrors, submitPolicyVersion: policy.version };
        }
        catch (error) {
            if (!(error instanceof common_1.ConflictException))
                throw error;
            return preview;
        }
    }
    approvedAssessment(request) {
        const policy = process.env.PORTAL_V2_ROLLOUT_ENABLED === 'true' ? (0, portal_approved_policy_2.getPolicyForScope)(Object.hasOwn(portal_approved_policy_2.SCOPE_POLICY_VERSIONS, request.data.businessScope) ? request.data.businessScope : 'MANUFACTURING') : (0, portal_approved_policy_1.getApprovedPolicy)();
        if (!(0, portal_intake_cycle_1.isIntakeEditable)(request))
            return null;
        try {
            return (0, portal_approved_policy_1.evaluateIntakeReadiness)(policy, request.data, request.documents, { phase: 'SUBMIT', submittedAt: new Date() });
        }
        catch (error) {
            if (!(error instanceof common_1.BadRequestException))
                throw error;
            return { policyVersion: policy.version, dataReady: false, canSubmit: false, canAccept: false, businessValidity: 'NOT_REVIEWED', creditDecision: null,
                missingFields: [], missingDocuments: [], requirements: [], formErrors: [error.message],
                issues: [{ code: 'INVALID_INPUT', path: 'data', step: 1, message: error.message }], note: 'Chưa đánh giá được checklist do dữ liệu hoặc metadata tài liệu không hợp lệ.' };
        }
    }
    body(body, keys) {
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !keys.includes(k)))
            throw new common_1.BadRequestException('Thông tin yêu cầu không hợp lệ.');
    }
    revision(r, expected) {
        if (expected === undefined && r.formVersion !== 2)
            return;
        if (typeof expected !== 'number' || !Number.isSafeInteger(expected) || expected < 0)
            throw new common_1.BadRequestException('Cần expectedRevision hợp lệ.');
        if (expected !== (r.revision ?? 0))
            throw new common_1.ConflictException('Bản nháp đã thay đổi. Vui lòng tải lại trước khi lưu.');
    }
    legacyOnly(r) {
        if ((r.formVersion ?? 1) !== 1 || (r.checklistVersion ?? portal_foundation_1.LEGACY_CHECKLIST_VERSION) !== portal_foundation_1.LEGACY_CHECKLIST_VERSION)
            throw new common_1.ConflictException('Chờ chốt chính sách checklist trước khi gửi hoặc tiếp nhận hồ sơ phiên bản mới.');
    }
    async intakeScope(user) {
        if (!user?.roles.includes('CBTD'))
            return { status: { in: ['SUBMITTED', 'ASSIGNED', 'RETURNED', 'ACCEPTED'] } };
        return { OR: [{ status: { in: ['ASSIGNED', 'RETURNED'] }, assignedTo: user.id }, { status: 'ACCEPTED', loan: { is: { assignedTo: user.id } } }] };
    }
    internalPublished(r) {
        if (this.usesCycle(r) && r.status === 'RETURNED') {
            const s = this.published(r);
            return { ...r, data: s.data, documents: s.documents };
        }
        return r;
    }
    async list(accountId, user) { const rows = await this.prisma.portalRequest.findMany({ where: accountId ? { accountId } : await this.intakeScope(user), include, orderBy: { createdAt: 'desc' } }); return accountId ? rows : Promise.all(rows.map(r => this.internalCoordinationView(this.internalPublished(r), user?.id))); }
    async internalCoordinationView(r, actorId) {
        const pending = await this.prisma.assignmentChangeRequest.findMany({ where: { portalRequestId: r.id, status: 'PENDING', reasonCode: 'CONFLICT_OF_INTEREST' }, select: { requestedById: true } });
        const loan = r.loanId ? await this.prisma.loanApplication.findUnique({ where: { id: r.loanId }, select: { assignedTo: true, assignedUser: { select: officerSelect } } }) : null;
        return { ...r, currentLoanOfficer: loan?.assignedUser ?? null, coordinationRestrictions: { writeBlocked: pending.some(p => p.requestedById === actorId), decisionBlocked: pending.length > 0 } };
    }
    async one(id, accountId, user) {
        const r = await this.prisma.portalRequest.findFirst({ where: { id, ...(accountId ? { accountId } : await this.intakeScope(user)) }, include });
        if (!r)
            throw new common_1.NotFoundException('Không tìm thấy yêu cầu.');
        return accountId ? r : this.internalCoordinationView(this.internalPublished(r), user?.id);
    }
    async tracking(id, accountId) {
        const r = await this.prisma.portalRequest.findFirst({ where: { id, accountId }, select: { id: true, reference: true, status: true, submittedAt: true, acceptedAt: true,
                loan: { select: { currentStage: true, currentStatus: true, completedAt: true, rejectionReasonCode: true, stageHistories: { select: { stage: { select: { stageCode: true } } } } } } } });
        if (!r)
            throw new common_1.NotFoundException('Không tìm thấy yêu cầu.');
        return (0, portal_tracking_1.buildTracking)(r, r.loan);
    }
    async create(accountId, body) {
        this.body(body, ['data', 'formVersion', 'clientRequestId']);
        const formVersion = body.formVersion ?? 1;
        if (formVersion === 1 && process.env.PORTAL_V2_ROLLOUT_ENABLED === 'true')
            throw new common_1.ConflictException('Đề nghị mới sử dụng Portal V2.');
        if (![1, 2].includes(formVersion))
            throw new common_1.BadRequestException('Phiên bản biểu mẫu không hỗ trợ.');
        if (formVersion === 2)
            (0, portal_foundation_1.assertPreviewEnabled)();
        const key = body.clientRequestId;
        if (key !== undefined && (formVersion !== 2 || typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)))
            throw new common_1.BadRequestException('clientRequestId chỉ hỗ trợ UUIDv4 cho bản nháp v2.');
        const createData = () => ({ accountId, data: formVersion === 2 ? (0, portal_foundation_1.validateDraftV2)(body.data ?? {}) : (0, portal_validation_1.validatePortalData)(body.data ?? {}), formVersion, checklistVersion: formVersion === 2 ? portal_foundation_1.PREVIEW_CHECKLIST_VERSION : portal_foundation_1.LEGACY_CHECKLIST_VERSION });
        if (key === undefined)
            return this.prisma.$transaction(async (tx) => {
                const data = createData();
                return tx.portalRequest.create({ data: { ...data, reference: await (0, document_codes_1.nextDocumentCode)(tx, 'DN') }, include });
            });
        const id = key.toLowerCase();
        const conflict = () => new common_1.ConflictException('Không thể tạo bản nháp với mã yêu cầu này.');
        try {
            return await this.prisma.$transaction(async (tx) => {
                await tx.$queryRaw `SELECT pg_advisory_xact_lock(hashtext(${`portal-create:${accountId}:${id}`}))::text`;
                const existing = await tx.portalRequest.findUnique({ where: { id }, include });
                if (existing) {
                    if (existing.accountId !== accountId || existing.formVersion !== 2)
                        throw conflict();
                    return existing;
                }
                const data = createData();
                return tx.portalRequest.create({ data: { ...data, id, reference: await (0, document_codes_1.nextDocumentCode)(tx, 'DN') }, include });
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
                throw conflict();
            throw error;
        }
    }
    async locked(tx, id, accountId) {
        await tx.$queryRaw `SELECT id FROM portal_requests WHERE id=${id} AND account_id=${accountId} FOR UPDATE`;
        const r = await tx.portalRequest.findFirst({ where: { id, accountId }, include });
        if (!r)
            throw new common_1.NotFoundException('Không tìm thấy yêu cầu.');
        return r;
    }
    draft(status) { if (status !== 'DRAFT' && !(status === 'RETURNED' && (0, portal_intake_cycle_1.intakeCycleEnabled)()))
        throw new common_1.ConflictException('Yêu cầu chưa được mở chỉnh sửa.'); }
    async update(id, accountId, body) {
        this.body(body, ['data', 'expectedRevision']);
        return this.prisma.$transaction(async (tx) => {
            const r = await this.locked(tx, id, accountId);
            this.draft(r.status);
            if (r.formVersion === 2)
                (0, portal_foundation_1.assertPreviewEnabled)();
            this.revision(r, body.expectedRevision);
            const data = r.formVersion === 2 ? (0, portal_foundation_1.validateDraftV2)(body.data) : (0, portal_validation_1.validatePortalData)(body.data);
            if (this.usesCycle(r) && data.taxCode !== r.checklistSnapshot?.data?.taxCode)
                throw new common_1.ConflictException('Thay chủ thể/MST cần lập đề nghị mới.');
            return tx.portalRequest.update({ where: { id }, data: { data, revision: (r.revision ?? 0) + 1 }, include });
        });
    }
    async upload(id, accountId, group, file, options = {}, supersedesId) {
        this.body(options, ['coverage', 'clientUploadId', 'expectedRevision']);
        const initial = await this.one(id, accountId);
        this.draft(initial.status);
        const v2 = initial.formVersion === 2;
        if (v2)
            (0, portal_foundation_1.assertPreviewEnabled)();
        if (!v2 && (supersedesId || Object.keys(options).length))
            throw new common_1.BadRequestException('Metadata phiên bản mới chỉ dùng cho bản nháp v2.');
        const coverage = v2 ? (0, portal_foundation_1.validateCoverage)(group, options.coverage) : undefined;
        if (v2 && (typeof options.clientUploadId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(options.clientUploadId)))
            throw new common_1.BadRequestException('Cần clientUploadId hợp lệ để tải tệp an toàn khi thử lại.');
        const meta = await (0, portal_validation_1.validatePortalFile)(group, file);
        const contentHash = (0, node_crypto_1.createHash)('sha256').update(file.buffer).update(JSON.stringify({ group, coverage, fileName: meta.fileName, supersedesId: supersedesId ?? null })).digest('hex');
        const key = (0, node_crypto_1.randomUUID)();
        await (0, promises_1.mkdir)(this.dir, { recursive: true });
        await (0, promises_1.writeFile)((0, node_path_1.join)(this.dir, key), file.buffer, { flag: 'wx' });
        let retained = false;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const r = await this.locked(tx, id, accountId);
                this.draft(r.status);
                if (v2) {
                    const retry = await tx.portalDocument.findUnique({ where: { requestId_clientUploadId: { requestId: id, clientUploadId: options.clientUploadId } } });
                    if (retry) {
                        if (retry.contentHash !== contentHash)
                            throw new common_1.ConflictException('clientUploadId đã dùng cho nội dung khác.');
                        return r;
                    }
                    this.revision(r, options.expectedRevision);
                }
                if (!supersedesId && r.documents.length >= 60)
                    throw new common_1.BadRequestException('Tối đa 60 tệp hiện hành cho mỗi yêu cầu.');
                let previous;
                if (supersedesId) {
                    previous = r.documents.find(d => d.id === supersedesId);
                    if (!previous)
                        throw new common_1.ConflictException('Tệp cần thay thế không còn là phiên bản hiện hành.');
                    if (previous.documentGroup !== group)
                        throw new common_1.BadRequestException('Tệp thay thế phải giữ nhóm chứng từ.');
                }
                await tx.portalDocument.create({ data: { requestId: id, documentGroup: group, fileName: meta.fileName, mimeType: meta.mimeType, fileSize: file.size, filePath: key, ...(v2 ? { coverage: coverage, clientUploadId: options.clientUploadId, contentHash, supersedesId, version: (previous?.version ?? 0) + 1 } : {}) } });
                await tx.portalRequest.update({ where: { id }, data: { revision: (r.revision ?? 0) + 1 } });
                retained = true;
                return tx.portalRequest.findUniqueOrThrow({ where: { id }, include });
            });
        }
        catch (e) {
            retained = false;
            throw e;
        }
        finally {
            if (!retained)
                await (0, promises_1.unlink)((0, node_path_1.join)(this.dir, key)).catch(() => undefined);
        }
    }
    async deleteDocument(id, accountId, documentId, expectedRevision) {
        const result = await this.prisma.$transaction(async (tx) => {
            const r = await this.locked(tx, id, accountId);
            this.draft(r.status);
            if (r.formVersion === 2)
                (0, portal_foundation_1.assertPreviewEnabled)();
            this.revision(r, expectedRevision);
            const d = await tx.portalDocument.findFirst({ where: { id: documentId, requestId: id, ...activeDocuments } });
            if (!d)
                throw new common_1.NotFoundException('Không tìm thấy tệp.');
            if (r.formVersion === 2)
                await tx.portalDocument.update({ where: { id: documentId }, data: { withdrawnAt: new Date() } });
            else
                await tx.portalDocument.delete({ where: { id: documentId } });
            await tx.portalRequest.update({ where: { id }, data: { revision: (r.revision ?? 0) + 1 } });
            return { document: d, keep: r.formVersion === 2, request: await tx.portalRequest.findUniqueOrThrow({ where: { id }, include }) };
        });
        if (!result.keep)
            await (0, promises_1.unlink)((0, node_path_1.join)(this.dir, result.document.filePath)).catch(() => undefined);
        return result.request;
    }
    async documentVersions(id, accountId, documentId) {
        await this.one(id, accountId);
        const all = await this.prisma.portalDocument.findMany({ where: { requestId: id }, select: documentSelect });
        const target = all.find(d => d.id === documentId);
        if (!target)
            throw new common_1.NotFoundException('Không tìm thấy tệp.');
        const byId = new Map(all.map(d => [d.id, d]));
        const chain = new Set();
        let current = target;
        while (current && !chain.has(current.id)) {
            chain.add(current.id);
            current = current.supersedesId ? byId.get(current.supersedesId) : undefined;
        }
        let changed = true;
        while (changed) {
            changed = false;
            for (const d of all)
                if (d.supersedesId && chain.has(d.supersedesId) && !chain.has(d.id)) {
                    chain.add(d.id);
                    changed = true;
                }
        }
        return all.filter(d => chain.has(d.id)).sort((a, b) => a.version - b.version);
    }
    async documentHeads(id, accountId) {
        await this.one(id, accountId);
        return this.prisma.portalDocument.findMany({ where: { requestId: id, nextVersion: { is: null } }, select: documentSelect, orderBy: { uploadedAt: 'desc' } });
    }
    async download(id, documentId, accountId, user) {
        const request = await this.one(id, accountId, user);
        let frozen = !accountId && request.formVersion === 2 ? this.published(request).documents.find(d => d.id === documentId) : undefined;
        if (!frozen && this.usesCycle(request)) {
            const versions = await this.prisma.portalSubmission.findMany({ where: { requestId: id }, orderBy: { sequence: 'desc' } });
            for (const s of versions) {
                const found = this.cycle().snapshot(s).documents.find(d => d.id === documentId);
                if (found) {
                    frozen = found;
                    break;
                }
            }
        }
        if (!accountId && request.formVersion === 2 && !frozen)
            throw new common_1.NotFoundException('Tệp không thuộc snapshot đề nghị đã gửi.');
        const d = await this.prisma.portalDocument.findFirst({ where: { id: documentId, requestId: id } });
        if (!d || (0, node_path_1.basename)(d.filePath) !== d.filePath)
            throw new common_1.NotFoundException('Không tìm thấy tệp.');
        let buffer;
        try {
            buffer = await (0, promises_1.readFile)((0, node_path_1.join)(this.dir, d.filePath));
        }
        catch {
            throw new common_1.NotFoundException('Không tìm thấy tệp đã lưu.');
        }
        if (frozen && (buffer.length !== frozen.fileSize || (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex') !== frozen.sha256
            || !(0, portal_snapshot_1.sameJson)({ id: d.id, documentGroup: d.documentGroup, fileName: d.fileName, fileSize: d.fileSize, mimeType: d.mimeType, uploadedAt: new Date(d.uploadedAt).toISOString(), coverage: d.coverage, version: d.version, contentHash: d.contentHash ?? null }, { id: frozen.id, documentGroup: frozen.documentGroup, fileName: frozen.fileName, fileSize: frozen.fileSize, mimeType: frozen.mimeType, uploadedAt: frozen.uploadedAt, coverage: frozen.coverage, version: frozen.version, contentHash: frozen.contentHash })))
            throw new common_1.ConflictException('Chứng từ không khớp snapshot đã gửi; chưa thể tải để kiểm tra.');
        return { buffer, fileName: frozen?.fileName ?? d.fileName };
    }
    async physicalFiles(documents) {
        return Promise.all(documents.map(async (d) => {
            if ((0, node_path_1.basename)(d.filePath) !== d.filePath)
                throw new common_1.ConflictException('Đường dẫn chứng từ không hợp lệ.');
            let buffer;
            try {
                buffer = await (0, promises_1.readFile)((0, node_path_1.join)(this.dir, d.filePath));
            }
            catch {
                throw new common_1.ConflictException('Không tìm thấy chứng từ đã lưu; chưa thể gửi hoặc tiếp nhận.');
            }
            if (buffer.length !== d.fileSize)
                throw new common_1.ConflictException('Dung lượng chứng từ không đồng nhất.');
            await (0, portal_validation_1.validatePortalFile)(d.documentGroup, { buffer, originalname: d.fileName, size: buffer.length, mimetype: d.mimeType });
            return { ...d, sha256: (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex') };
        }));
    }
    submitManifest(body, revision, documentIds) {
        this.body(body, ['expectedRevision', 'documentIds']);
        if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || !Array.isArray(body.documentIds) || body.documentIds.some((id) => typeof id !== 'string') || new Set(body.documentIds).size !== body.documentIds.length)
            throw new common_1.BadRequestException('Cần revision và danh sách tài liệu đã tải hoàn tất.');
        if (body.expectedRevision !== revision || !(0, portal_snapshot_1.sameJson)([...body.documentIds].sort(), [...documentIds].sort()))
            throw new common_1.ConflictException('Bản nháp hoặc danh sách tài liệu đã thay đổi. Vui lòng tải lại và rà soát.');
    }
    async submit(id, accountId, body) {
        return this.prisma.$transaction(async (tx) => {
            const r = await this.locked(tx, id, accountId);
            if (r.formVersion === 2) {
                if ((0, portal_intake_cycle_1.intakeCycleEnabled)() || this.usesCycle(r)) {
                    if (!(0, portal_intake_cycle_1.intakeCycleEnabled)())
                        throw new common_1.ConflictException('Chức năng gửi mới đang tạm khóa.');
                    if (['DRAFT', 'RETURNED'].includes(r.status))
                        (0, loan_policy_1.assertBranchAmount)(r.data.proposedAmount);
                    return this.cycle().publish(tx, r, body);
                }
                const currentPolicy = (0, portal_policy_1.resolveTestPolicy)(this.policyContext);
                if (r.status !== 'DRAFT') {
                    const snapshot = (0, portal_snapshot_1.readV2Snapshot)(r);
                    this.submitManifest(body, snapshot.revision, snapshot.documents.map(d => d.id));
                    return r;
                }
                this.submitManifest(body, r.revision, r.documents.map(d => d.id));
                const evaluation = (0, portal_policy_1.evaluatePolicy)(currentPolicy, r.data, r.documents, 'SUBMIT');
                if (evaluation.formErrors.length || evaluation.missing.length)
                    throw new common_1.BadRequestException([...evaluation.formErrors, ...evaluation.missing.map(item => `Thiếu tài liệu: ${item}`)].join('\n'));
                const all = await tx.portalDocument.findMany({ where: { requestId: id, ...activeDocuments } });
                const docs = await this.physicalFiles(all);
                const now = new Date(), snapshot = (0, portal_snapshot_1.createV2Snapshot)(r, currentPolicy, evaluation.requirements, docs, now);
                const request = await tx.portalRequest.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: now, checklistVersion: currentPolicy.version, checklistSnapshot: snapshot }, include });
                const managers = await tx.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'QUAN_LY' } } } }, select: { id: true } });
                if (managers.length)
                    await tx.internalNotification.createMany({ data: managers.map(manager => ({ userId: manager.id, requestId: id, title: 'Đề nghị doanh nghiệp chờ phân công', message: `Đề nghị ${r.reference} đã gửi, đang chờ phân công CBTD.` })) });
                return request;
            }
            if (r.status !== 'DRAFT')
                return r;
            if (process.env.PORTAL_V2_ROLLOUT_ENABLED === 'true')
                throw new common_1.ConflictException('Vui lòng tạo V2 từ bản nháp V1; bản cũ được giữ nguyên.');
            (0, loan_policy_1.assertBranchAmount)(r.data.proposedAmount);
            this.legacyOnly(r);
            (0, portal_validation_1.validatePortalData)(r.data, true);
            if (portal_validation_1.groups.some(g => !r.documents.some(d => d.documentGroup === g)))
                throw new common_1.BadRequestException('Cần tải ít nhất một tệp cho mỗi nhóm A, B, C, D, E, F.');
            const request = await tx.portalRequest.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date(), checklistSnapshot: { version: portal_foundation_1.LEGACY_CHECKLIST_VERSION, formVersion: 1, groups: [...portal_validation_1.groups], documentIds: r.documents.map(d => d.id) } }, include });
            const managers = await tx.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'QUAN_LY' } } } }, select: { id: true } });
            if (managers.length)
                await tx.internalNotification.createMany({ data: managers.map(manager => ({ userId: manager.id, requestId: id, title: 'Đề nghị doanh nghiệp chờ phân công', message: `Đề nghị ${r.reference} đã gửi, đang chờ phân công CBTD.` })) });
            return request;
        }, { timeout: 30000 });
    }
    async companyMatch(id, user) {
        const r = await this.one(id, undefined, user);
        const data = r.data;
        const company = await this.prisma.company.findUnique({ where: { taxCode: data.taxCode } });
        return { found: !!company, company, companyHash: company ? (0, portal_intake_cycle_2.intakeDigest)((0, company_snapshot_1.companySnapshot)(company)) : null, ...(company && r.formVersion === 2 ? { financialReadiness: this.companyComparison(r, data, company) } : {}) };
    }
    async readiness(id, accountId, user) {
        const request = await this.one(id, accountId, user);
        return request.formVersion === 2 ? { ...(0, portal_readiness_1.assessReadiness)(request.data, request.documents), approvedIntakeAssessment: this.approvedAssessment(request) } : { version: 'V1', dataReady: null, canSubmit: false, issues: [], note: 'Hồ sơ V1 giữ luồng cũ.' };
    }
    async officers() { return (0, officer_workloads_1.officerWorkloads)(this.prisma); }
    async assignmentHistory(id, user) {
        await this.one(id, undefined, user);
        return this.prisma.portalAssignment.findMany({ where: { requestId: id }, select: { id: true, fromUser: { select: officerSelect }, toUser: { select: officerSelect }, manager: { select: officerSelect }, note: true, assignedAt: true }, orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }] });
    }
    async assign(id, body, managerId) {
        if (body?.officerId === managerId)
            throw new common_1.BadRequestException('Quản lý không được tự giao hồ sơ cho chính mình.');
        return this.prisma.$transaction(tx => (0, assignment_transactions_1.transferPortal)(tx, id, body, managerId, include));
    }
    async accept(id, userId, confirmExistingCompany = false, confirmExistingCompanyFinancials = false, expectedRevision, submissionId, clock = new Date()) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM portal_requests WHERE id=${id} FOR UPDATE`;
            const r = await tx.portalRequest.findUnique({ where: { id }, include: { documents: { where: activeDocuments } } });
            if (!r || r.status === 'DRAFT')
                throw new common_1.NotFoundException('Không tìm thấy yêu cầu đã gửi.');
            if (r.status === 'ACCEPTED') {
                const loan = r.loanId ? await tx.loanApplication.findFirst({ where: { id: r.loanId, assignedTo: userId }, select: { id: true } }) : null;
                if (!loan)
                    throw new common_1.NotFoundException('Hồ sơ đã được điều chuyển hoặc không còn trong phạm vi phụ trách.');
                return { loanId: r.loanId, request: await tx.portalRequest.findUniqueOrThrow({ where: { id }, include }) };
            }
            if (r.status !== 'ASSIGNED' || r.assignedTo !== userId)
                throw new common_1.NotFoundException('Không tìm thấy yêu cầu được phân công.');
            await (0, assignment_coordination_1.assertNoCoordinationConflict)(tx, { portalRequestId: id }, userId);
            let data, intakeDocuments = r.documents;
            if (r.formVersion === 2) {
                if (!this.usesCycle(r))
                    (0, portal_policy_1.resolveTestPolicy)(this.policyContext);
                const snapshot = this.usesCycle(r) ? await this.cycle().assertAccept(tx, r, expectedRevision, submissionId) : (0, portal_snapshot_1.readV2Snapshot)(r);
                const evaluation = (0, portal_policy_1.evaluatePolicy)(snapshot.policy, snapshot.data, snapshot.documents, 'INTAKE');
                if (evaluation.missing.length || evaluation.formErrors.length)
                    throw new common_1.BadRequestException('Snapshot chưa đủ điều kiện tiếp nhận theo policy đã chốt lúc gửi.');
                const physical = await this.physicalFiles(intakeDocuments);
                const actual = physical.map(d => ({ id: d.id, documentGroup: d.documentGroup, fileName: d.fileName, fileSize: d.fileSize, mimeType: d.mimeType, uploadedAt: d.uploadedAt.toISOString(), coverage: d.coverage, version: d.version, contentHash: d.contentHash ?? null, sha256: d.sha256 }));
                const ordered = (items) => [...items].sort((a, b) => a.id.localeCompare(b.id));
                if (!(0, portal_snapshot_1.sameJson)(ordered(actual), ordered(snapshot.documents)))
                    throw new common_1.ConflictException('Chứng từ hiện có khác snapshot đã gửi; chưa thể tiếp nhận.');
                const companyFields = ['taxCode', 'companyName', 'industry', 'establishedYear', 'annualRevenue', 'charterCapital', 'representativeName', 'phone', 'address', 'loanPurpose', 'loanType', 'proposedAmount', 'loanTermMonths'];
                data = (0, portal_validation_1.validatePortalData)(Object.fromEntries(companyFields.filter(key => snapshot.data[key] !== undefined).map(key => [key, snapshot.data[key]])), true);
            }
            else {
                this.legacyOnly(r);
                data = (0, portal_validation_1.validatePortalData)(r.data, true);
                const frozen = r.checklistSnapshot;
                if (frozen?.documentIds && !(0, portal_snapshot_1.sameJson)([...frozen.documentIds].sort(), intakeDocuments.map(d => d.id).sort()))
                    throw new common_1.ConflictException('Tài liệu V1 không khớp snapshot đã gửi.');
            }
            (0, loan_policy_1.assertBranchAmount)(data.proposedAmount);
            await (0, loan_policy_1.lockOfficer)(tx, userId);
            const actor = await tx.user.findFirst({ where: { id: userId, isActive: true, roles: { some: { role: { code: 'CBTD' } } } } });
            if (!actor)
                throw new common_1.BadRequestException('CBTD không còn hoạt động hoặc đã mất quyền.');
            await (0, assignment_coordination_1.assertNoCompanyConflict)(tx, userId, data.taxCode);
            await (0, company_snapshot_1.lockCompany)(tx, data.taxCode);
            let company = await tx.company.findUnique({ where: { taxCode: data.taxCode } });
            if (company && !confirmExistingCompany)
                throw new common_1.ConflictException('Mã số thuế đã tồn tại. Cần xác nhận liên kết doanh nghiệp hiện có; thông tin hiện có sẽ được giữ nguyên.');
            let financialReview = '';
            if (company && r.formVersion === 2 && (this.usesCycle(r) || (0, portal_snapshot_1.readV2Snapshot)(r).policy.readinessVersion === 'MVP1')) {
                const comparison = this.companyComparison(r, data, company);
                if (!comparison.compatible)
                    throw new common_1.ConflictException(comparison.message);
                if (!confirmExistingCompanyFinancials)
                    throw new common_1.ConflictException('CBTD cần xác nhận đã đối chiếu kỳ và nguồn dữ liệu tài chính Company hiện hữu. Không tự ghi đè.');
                financialReview = `; CBTD ${userId} xác nhận đối chiếu tài chính Company ${company.id}, kỳ ${String(r.data.revenuePeriod)}, nguồn ${String(r.data.annualRevenueBasis?.documentId)}`;
            }
            const { loanPurpose, loanType, proposedAmount, loanTermMonths } = data;
            const companyData = Object.fromEntries(['taxCode', 'companyName', 'industry', 'establishedYear', 'annualRevenue', 'charterCapital', 'representativeName', 'phone', 'address'].map(key => [key, data[key]]));
            if (!company)
                company = await tx.company.create({ data: companyData });
            const stage = await tx.workflowStage.findUnique({ where: { stageCode: 'TIEP_NHAN' } });
            if (!stage)
                throw new common_1.BadRequestException('Chưa cấu hình công đoạn Tiếp nhận.');
            const now = clock;
            const slaMode = await (0, sla_policy_1.resolveStageSla)(tx, now);
            const loan = await tx.loanApplication.create({ data: { applicationCode: await (0, document_codes_1.nextDocumentCode)(tx, 'SME'), companyId: company.id, companySnapshot: (0, company_snapshot_1.companySnapshot)(company), businessPolicyVersion: loan_policy_1.BRANCH_POLICY, intakeOfficerId: userId, loanPurpose, loanType, proposedAmount, loanTermMonths, assignedTo: userId, currentStage: 'TIEP_NHAN', currentStatus: 'RECEIVED', stageHistories: { create: { stageId: stage.id, enteredAt: now, slaStandardHours: stage.standardSlaHours, ...slaMode, handledBy: userId, notes: `Tiếp nhận yêu cầu doanh nghiệp ${r.reference}${financialReview}` } } } });
            await tx.document.createMany({ data: r.documents.map(d => ({ applicationId: loan.id, documentType: documentTypes[d.documentGroup], fileName: d.fileName, filePath: d.filePath, fileSize: d.fileSize, mimeType: d.mimeType, uploadedBy: userId, uploadedAt: d.uploadedAt, portalDocumentId: d.id })) });
            await (0, assignment_coordination_1.obsoleteCoordination)(tx, { portalRequestId: id }, 'PORTAL_ACCEPTED');
            const request = await tx.portalRequest.update({ where: { id }, data: { status: 'ACCEPTED', acceptedAt: now, acceptedBy: userId, loanId: loan.id }, include });
            return { loanId: loan.id, request };
        }, { timeout: 15000 });
    }
    async intakeCycle(id, accountId, user) {
        const r = await this.one(id, accountId, user);
        return this.cycle().view(r, !accountId);
    }
    reviewIntake(id, body, user) { return this.cycle().review(id, body, user); }
    returnIntake(id, body, user) { return this.cycle().returnForCorrection(id, body, user); }
    requestIntakeCorrection(id, body, accountId) { return this.cycle().requestCorrection(id, body, accountId); }
    decideIntakeCorrection(id, body, user) { return this.cycle().decideCorrection(id, body, user); }
    requestCompanyReconciliation(id, body, user) { return this.cycle().requestCompanyReconciliation(id, body, user); }
    resolveCompanyReconciliation(id, body, user) { return this.cycle().resolveCompanyReconciliation(id, body, user); }
    intakeIssue(id, body, user) { return this.cycle().issue(id, body, user); }
};
exports.PortalService = PortalService;
exports.PortalService = PortalService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)('PORTAL_POLICY_CONTEXT')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], PortalService);
//# sourceMappingURL=portal.service.js.map