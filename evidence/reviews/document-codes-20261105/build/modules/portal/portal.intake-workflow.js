"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortalIntakeWorkflow = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const assignment_coordination_1 = require("../assignments/assignment-coordination");
const company_snapshot_1 = require("../companies/company-snapshot");
const portal_approved_policy_1 = require("./portal.approved-policy");
const portal_snapshot_1 = require("./portal.snapshot");
const portal_intake_cycle_1 = require("./portal.intake-cycle");
const json = (value) => JSON.parse(JSON.stringify(value));
class PortalIntakeWorkflow {
    db;
    include;
    physicalFiles;
    constructor(db, include, physicalFiles) {
        this.db = db;
        this.include = include;
        this.physicalFiles = physicalFiles;
    }
    body(body, keys) {
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !keys.includes(k))
            || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || typeof body.clientRequestId !== 'string'
            || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientRequestId))
            throw new common_1.BadRequestException('Cần phiên bản và mã thao tác UUID hợp lệ.');
    }
    text(value, label) {
        if (typeof value !== 'string' || !value.trim() || value.length > 4000)
            throw new common_1.BadRequestException(`Cần ${label}, tối đa 4000 ký tự.`);
        return value.trim();
    }
    async lock(tx, id, actor, managerOnly = false) {
        await tx.$queryRaw `SELECT id FROM portal_requests WHERE id=${id} FOR UPDATE`;
        const r = await tx.portalRequest.findUnique({ where: { id }, include: this.include });
        const owner = typeof actor === 'string';
        const allowed = owner ? r?.accountId === actor : managerOnly ? actor.roles.includes('QUAN_LY') :
            actor.roles.includes('CBTD') && r?.assignedTo === actor.id;
        if (!r || !allowed || r.formVersion !== 2 || r.status === 'DRAFT')
            throw new common_1.NotFoundException('Không tìm thấy đề nghị trong phạm vi xử lý.');
        if (!owner)
            await (0, assignment_coordination_1.assertNoCoordinationConflict)(tx, { portalRequestId: id }, actor.id);
        return r;
    }
    async operation(tx, r, body, actorId, kind) {
        const payloadHash = (0, portal_intake_cycle_1.intakeDigest)({ kind, body });
        const prior = await tx.portalIntakeOperation.findUnique({ where: { requestId_clientRequestId: { requestId: r.id, clientRequestId: body.clientRequestId } } });
        if (prior) {
            if (prior.actorId !== actorId || prior.kind !== kind || prior.payloadHash !== payloadHash)
                throw new common_1.ConflictException('Mã thao tác đã được dùng với nội dung khác.');
            return true;
        }
        if (r.revision !== body.expectedRevision)
            throw new common_1.ConflictException('Đề nghị hoặc kết quả kiểm tra đã đổi; hãy tải lại.');
        await tx.portalIntakeOperation.create({ data: { requestId: r.id, clientRequestId: body.clientRequestId, actorId, kind, payloadHash } });
        return false;
    }
    async latest(tx, id) {
        const s = await tx.portalSubmission.findFirst({ where: { requestId: id }, orderBy: { sequence: 'desc' } });
        if (!s)
            throw new common_1.ConflictException('Đề nghị chưa có lần gửi theo quy trình mới.');
        this.snapshot(s);
        return s;
    }
    snapshot(s) {
        const raw = s.snapshot;
        return (0, portal_snapshot_1.readV2Snapshot)({ id: s.requestId, accountId: raw?.audit?.actorAccountId, revision: s.sourceRevision,
            checklistVersion: raw?.checklistVersion, submittedAt: s.submittedAt, data: raw?.data, checklistSnapshot: raw });
    }
    async latestSnapshot(id) {
        const s = await this.db.portalSubmission.findFirst({ where: { requestId: id }, orderBy: { sequence: 'desc' } });
        return s ? this.snapshot(s) : null;
    }
    async publish(tx, r, body) {
        if (!body || Object.keys(body).some(k => !['expectedRevision', 'documentIds'].includes(k)) || !Number.isSafeInteger(body.expectedRevision)
            || !Array.isArray(body.documentIds) || body.documentIds.some((x) => typeof x !== 'string') || new Set(body.documentIds).size !== body.documentIds.length)
            throw new common_1.BadRequestException('Cần phiên bản và danh sách tài liệu đã hoàn tất.');
        const previous = await tx.portalSubmission.findFirst({ where: { requestId: r.id }, orderBy: { sequence: 'desc' } });
        const retry = await tx.portalSubmission.findUnique({ where: { requestId_sourceRevision: { requestId: r.id, sourceRevision: body.expectedRevision } } });
        if (retry) {
            if (!(0, portal_snapshot_1.sameJson)([...body.documentIds].sort(), this.snapshot(retry).documents.map(d => d.id).sort()))
                throw new common_1.ConflictException('Lần gửi trước có danh sách tài liệu khác.');
            return r;
        }
        if (!['DRAFT', 'RETURNED'].includes(r.status) || r.revision !== body.expectedRevision)
            throw new common_1.ConflictException('Đề nghị chưa được mở sửa hoặc phiên bản đã đổi.');
        if (previous && this.snapshot(previous).data.taxCode !== r.data.taxCode)
            throw new common_1.ConflictException('Thay chủ thể/MST cần lập đề nghị mới.');
        if (!(0, portal_snapshot_1.sameJson)([...body.documentIds].sort(), r.documents.map((d) => d.id).sort()))
            throw new common_1.ConflictException('Danh sách tài liệu đã đổi.');
        const now = new Date(), policy = process.env.PORTAL_V2_ROLLOUT_ENABLED === 'true' ? (0, portal_approved_policy_1.getPolicyForScope)(r.data.businessScope) : (0, portal_approved_policy_1.getApprovedPolicy)();
        const assessment = (0, portal_approved_policy_1.evaluateIntakeReadiness)(policy, r.data, r.documents, { phase: 'SUBMIT', submittedAt: now });
        if (!assessment.dataReady)
            throw new common_1.BadRequestException(assessment.issues.map(i => i.message).concat(assessment.formErrors).join('\n') || 'Chưa đủ hồ sơ theo checklist.');
        const files = await tx.portalDocument.findMany({ where: { requestId: r.id, withdrawnAt: null, nextVersion: { is: null } } });
        const physical = await this.physicalFiles(files);
        const snapshot = (0, portal_snapshot_1.createV2Snapshot)(r, policy, assessment.requirements, physical, now);
        const items = (0, portal_intake_cycle_1.intakeChecklist)(snapshot);
        const reviews = previous && !previous.returnItems?.some(i => i.invalidateReviews) ? (0, portal_intake_cycle_1.carryReviews)(previous.reviews, items, previous.id) : [];
        const { submissionChanges } = await Promise.resolve().then(() => require('./portal.intake-cycle'));
        await tx.portalSubmission.create({ data: { requestId: r.id, sequence: (previous?.sequence ?? 0) + 1, sourceRevision: r.revision,
                snapshot: json(snapshot), submittedAt: now, reviews: json(reviews), changes: json(submissionChanges(previous ? this.snapshot(previous) : null, snapshot)) } });
        const request = await tx.portalRequest.update({ where: { id: r.id }, data: { status: r.assignedTo ? 'ASSIGNED' : 'SUBMITTED', submittedAt: now,
                checklistVersion: policy.version, checklistSnapshot: json(snapshot), correctionRequest: client_1.Prisma.DbNull }, include: this.include });
        const recipients = r.assignedTo ? [{ id: r.assignedTo }] : await tx.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'QUAN_LY' } } } }, select: { id: true } });
        if (recipients.length)
            await tx.internalNotification.createMany({ data: recipients.map(u => ({ userId: u.id, requestId: r.id, title: previous ? 'Đề nghị đã gửi lại' : 'Đề nghị chờ phân công', message: `Đề nghị ${r.reference} đã gửi lần ${(previous?.sequence ?? 0) + 1}.` })) });
        return request;
    }
    async view(r, internal) {
        const submissions = await this.db.portalSubmission.findMany({ where: { requestId: r.id }, orderBy: { sequence: 'desc' } });
        const issues = await this.db.portalIntakeIssue.findMany({ where: { requestId: r.id }, orderBy: { createdAt: 'desc' } });
        const latest = submissions[0];
        const items = latest ? (0, portal_intake_cycle_1.intakeChecklist)(this.snapshot(latest)) : [];
        const reviews = (latest?.reviews ?? []);
        let complete = false;
        try {
            (0, portal_intake_cycle_1.assertReviewsComplete)(items, reviews);
            complete = true;
        }
        catch { }
        return { requestId: r.id, revision: r.revision, status: r.status, currentSubmissionId: latest?.id ?? null,
            correctionRequest: r.correctionRequest ?? null, correctionHistory: r.correctionHistory ?? [],
            canAccept: r.status === 'ASSIGNED' && complete && !(0, portal_intake_cycle_1.hasPendingCorrection)(r.correctionRequest) && !issues.some(i => i.status === 'OPEN'),
            checklist: items.map(i => ({ ...i, review: reviews.find(x => x.id === i.id) ? this.reviewView(reviews.find(x => x.id === i.id), internal) : null })),
            submissions: submissions.map(s => ({ id: s.id, sequence: s.sequence, submittedAt: s.submittedAt, returnedAt: s.returnedAt,
                snapshot: this.snapshot(s), changes: s.changes, returnItems: s.returnItems, reviews: s.reviews.map(x => this.reviewView(x, internal)) })),
            issues: issues.map(i => internal ? i : { id: i.id, status: i.status, publicMessage: i.publicMessage }) };
    }
    reviewView(r, internal) {
        return internal ? r : { id: r.id, label: r.label, decision: r.decision, message: r.message, documentIds: r.documentIds, carriedFrom: r.carriedFrom };
    }
    async review(id, body, actor) {
        this.body(body, ['expectedRevision', 'clientRequestId', 'submissionId', 'itemId', 'decision', 'message']);
        if (!['ACCEPTED', 'NEEDS_CORRECTION'].includes(body.decision) || typeof body.itemId !== 'string' || typeof body.submissionId !== 'string')
            throw new common_1.BadRequestException('Kết quả kiểm tra không hợp lệ.');
        const message = body.decision === 'NEEDS_CORRECTION' ? this.text(body.message, 'lý do cần sửa') : body.message === undefined ? '' : this.text(body.message, 'ghi nhận');
        return this.db.$transaction(async (tx) => {
            const r = await this.lock(tx, id, actor);
            if (await this.operation(tx, r, body, actor.id, 'REVIEW'))
                return tx.portalRequest.findUniqueOrThrow({ where: { id }, include: this.include });
            if (r.status !== 'ASSIGNED')
                throw new common_1.ConflictException('Chỉ kiểm tra khi đề nghị đang chờ ngân hàng xử lý.');
            const s = await this.latest(tx, id);
            if (s.id !== body.submissionId)
                throw new common_1.ConflictException('Lần gửi đã thay đổi.');
            const item = (0, portal_intake_cycle_1.intakeChecklist)(this.snapshot(s)).find(i => i.id === body.itemId);
            if (!item || !item.documentIds.length)
                throw new common_1.BadRequestException('Mục không thuộc checklist cần kiểm tra hoặc thiếu tài liệu.');
            const reviews = s.reviews.filter(x => x.id !== item.id);
            reviews.push({ ...item, decision: body.decision, message, reviewerId: actor.id, reviewedAt: new Date().toISOString() });
            await tx.portalSubmission.update({ where: { id: s.id }, data: { reviews: json(reviews) } });
            return tx.portalRequest.update({ where: { id }, data: { revision: { increment: 1 } }, include: this.include });
        });
    }
    async returnForCorrection(id, body, actor) {
        this.body(body, ['expectedRevision', 'clientRequestId', 'submissionId', 'dataCorrectionMessage']);
        const dataMessage = body.dataCorrectionMessage === undefined ? '' : this.text(body.dataCorrectionMessage, 'nội dung dữ liệu cần sửa');
        return this.db.$transaction(async (tx) => {
            const r = await this.lock(tx, id, actor);
            if (await this.operation(tx, r, body, actor.id, 'RETURN'))
                return r;
            if (r.status !== 'ASSIGNED')
                throw new common_1.ConflictException('Đề nghị không ở trạng thái có thể trả sửa.');
            if ((0, portal_intake_cycle_1.hasPendingCorrection)(r.correctionRequest))
                throw new common_1.ConflictException('Cần xử lý đề nghị xin sửa của doanh nghiệp trước.');
            const s = await this.latest(tx, id);
            if (s.id !== body.submissionId)
                throw new common_1.ConflictException('Lần gửi đã thay đổi.');
            const items = s.reviews.filter(x => x.decision === 'NEEDS_CORRECTION').map(x => ({ itemId: x.id, label: x.label, message: x.message, documentIds: x.documentIds }));
            if (dataMessage)
                items.push({ itemId: 'data.correction', label: 'Thông tin cần chỉnh sửa', message: dataMessage, documentIds: [], invalidateReviews: true });
            if (!items.length)
                throw new common_1.BadRequestException('Cần ghi rõ ít nhất một mục yêu cầu sửa trước khi trả.');
            await tx.portalSubmission.update({ where: { id: s.id }, data: { returnedAt: new Date(), returnItems: json(items) } });
            return tx.portalRequest.update({ where: { id }, data: { status: 'RETURNED', revision: { increment: 1 }, correctionRequest: client_1.Prisma.DbNull }, include: this.include });
        });
    }
    async requestCorrection(id, body, accountId) {
        this.body(body, ['expectedRevision', 'clientRequestId', 'message']);
        const message = this.text(body.message, 'nội dung cần chỉnh sửa');
        return this.db.$transaction(async (tx) => {
            const r = await this.lock(tx, id, accountId);
            if (await this.operation(tx, r, body, accountId, 'REQUEST_CORRECTION'))
                return r;
            if (!['SUBMITTED', 'ASSIGNED'].includes(r.status))
                throw new common_1.ConflictException('Chỉ đề nghị sửa trước khi được tiếp nhận.');
            if ((0, portal_intake_cycle_1.hasPendingCorrection)(r.correctionRequest))
                throw new common_1.ConflictException('Đang có đề nghị xin sửa chờ ngân hàng xử lý.');
            await this.latest(tx, id);
            const recipients = r.assignedTo ? [{ id: r.assignedTo }] : await tx.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'QUAN_LY' } } } }, select: { id: true } });
            if (recipients.length)
                await tx.internalNotification.createMany({ data: recipients.map(u => ({ userId: u.id, requestId: id, title: 'Doanh nghiệp đề nghị chỉnh sửa', message: `Cần xem xét đề nghị chỉnh sửa ${r.reference}.` })) });
            return tx.portalRequest.update({ where: { id }, data: { revision: { increment: 1 }, correctionRequest: json({ id: body.clientRequestId, status: 'PENDING', message, requestedAt: new Date().toISOString() }) }, include: this.include });
        });
    }
    async decideCorrection(id, body, actor) {
        this.body(body, ['expectedRevision', 'clientRequestId', 'submissionId', 'decision', 'reason']);
        if (!['APPROVE', 'REJECT'].includes(body.decision))
            throw new common_1.BadRequestException('Quyết định không hợp lệ.');
        const reason = this.text(body.reason, 'lý do xử lý');
        return this.db.$transaction(async (tx) => {
            const r = await this.lock(tx, id, actor);
            if (await this.operation(tx, r, body, actor.id, 'CORRECTION_DECISION'))
                return r;
            if (r.status !== 'ASSIGNED' || !(0, portal_intake_cycle_1.hasPendingCorrection)(r.correctionRequest))
                throw new common_1.ConflictException('Không có đề nghị xin sửa đang chờ xử lý.');
            const s = await this.latest(tx, id);
            if (s.id !== body.submissionId)
                throw new common_1.ConflictException('Lần gửi đã thay đổi.');
            const decision = { ...r.correctionRequest, status: body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', resolution: reason, resolvedAt: new Date().toISOString(), decisionOperationId: body.clientRequestId };
            if (body.decision === 'APPROVE') {
                const items = s.reviews.filter(x => x.decision === 'NEEDS_CORRECTION').map(x => ({ itemId: x.id, label: x.label, message: x.message, documentIds: x.documentIds }));
                items.push({ itemId: 'data.enterprise-request', label: 'Nội dung doanh nghiệp đề nghị sửa', message: reason, documentIds: [], invalidateReviews: true });
                await tx.portalSubmission.update({ where: { id: s.id }, data: { returnedAt: new Date(), returnItems: json(items) } });
            }
            return tx.portalRequest.update({ where: { id }, data: { status: body.decision === 'APPROVE' ? 'RETURNED' : 'ASSIGNED', revision: { increment: 1 }, correctionRequest: json(decision), correctionHistory: json([...(r.correctionHistory ?? []), decision]) }, include: this.include });
        });
    }
    async requestCompanyReconciliation(id, body, actor) {
        this.body(body, ['expectedRevision', 'clientRequestId', 'submissionId', 'companyHash', 'reason']);
        const reason = this.text(body.reason, 'căn cứ và nội dung đối soát');
        return this.db.$transaction(async (tx) => {
            const r = await this.lock(tx, id, actor);
            if (await this.operation(tx, r, body, actor.id, 'REQUEST_COMPANY_RECONCILIATION'))
                return r;
            if (r.status !== 'ASSIGNED')
                throw new common_1.ConflictException('Chỉ đối soát bản ngân hàng đang xử lý.');
            const s = await this.latest(tx, id);
            if (s.id !== body.submissionId)
                throw new common_1.ConflictException('Lần gửi đã thay đổi.');
            const data = this.snapshot(s).data;
            await (0, assignment_coordination_1.assertNoCompanyConflict)(tx, actor.id, data.taxCode);
            await (0, company_snapshot_1.lockCompany)(tx, data.taxCode);
            const company = await tx.company.findUnique({ where: { taxCode: data.taxCode } });
            if (!company || (0, portal_intake_cycle_1.intakeDigest)((0, company_snapshot_1.companySnapshot)(company)) !== body.companyHash)
                throw new common_1.ConflictException('Company đã thay đổi; tải lại đối soát.');
            if (!(0, portal_intake_cycle_1.approvedCompanyDifferences)(data, company).length)
                throw new common_1.BadRequestException('Thông tin đã khớp; không cần cập nhật Company.');
            if (await tx.portalIntakeIssue.findFirst({ where: { requestId: id, kind: 'COMPANY_RECONCILIATION', status: 'OPEN' } }))
                throw new common_1.ConflictException('Đang có đối soát Company chờ xử lý.');
            await tx.portalIntakeIssue.create({ data: { requestId: id, kind: 'COMPANY_RECONCILIATION', description: reason, proposal: 'QLCN xác minh căn cứ trước khi cập nhật riêng Company.', publicMessage: 'Ngân hàng đang đối soát thông tin doanh nghiệp.', createdBy: actor.id, updatedBy: actor.id, context: json({ submissionId: s.id, companyId: company.id, companyHash: body.companyHash, before: (0, company_snapshot_1.companySnapshot)(company), proposed: (0, company_snapshot_1.companySnapshot)(data) }) } });
            const managers = await tx.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'QUAN_LY' } } } }, select: { id: true } });
            if (managers.length)
                await tx.internalNotification.createMany({ data: managers.map(u => ({ userId: u.id, requestId: id, title: 'Đối soát doanh nghiệp chờ xử lý', message: `Cần xác minh đối soát ${r.reference}.` })) });
            return tx.portalRequest.update({ where: { id }, data: { revision: { increment: 1 } }, include: this.include });
        });
    }
    async resolveCompanyReconciliation(id, body, actor) {
        this.body(body, ['expectedRevision', 'clientRequestId', 'issueId', 'decision', 'reason']);
        if (!['APPROVE', 'REJECT'].includes(body.decision))
            throw new common_1.BadRequestException('Quyết định không hợp lệ.');
        const reason = this.text(body.reason, 'căn cứ quyết định đối soát');
        return this.db.$transaction(async (tx) => {
            const r = await this.lock(tx, id, actor, true);
            if (await this.operation(tx, r, body, actor.id, 'RESOLVE_COMPANY_RECONCILIATION'))
                return r;
            if (r.status === 'ACCEPTED')
                throw new common_1.ConflictException('Đề nghị đã tiếp nhận.');
            const issue = await tx.portalIntakeIssue.findFirst({ where: { id: body.issueId, requestId: id, kind: 'COMPANY_RECONCILIATION', status: 'OPEN' } });
            if (!issue)
                throw new common_1.NotFoundException('Không có đối soát đang chờ.');
            if (issue.createdBy === actor.id)
                throw new common_1.ForbiddenException('Không được tự xác nhận đối soát của mình.');
            if (body.decision === 'APPROVE') {
                if (r.status !== 'ASSIGNED')
                    throw new common_1.ConflictException('Chờ bản gửi mới trước khi xác nhận đối soát.');
                if ((0, portal_intake_cycle_1.hasPendingCorrection)(r.correctionRequest))
                    throw new common_1.ConflictException('Cần xử lý đề nghị xin sửa trước khi xác nhận đối soát.');
                const s = await this.latest(tx, id), context = issue.context;
                if (s.id !== context?.submissionId)
                    throw new common_1.ConflictException('Đối soát thuộc bản gửi cũ; từ chối và lập lại theo bản mới.');
                (0, portal_intake_cycle_1.assertReviewsComplete)((0, portal_intake_cycle_1.intakeChecklist)(this.snapshot(s)), s.reviews);
                const data = this.snapshot(s).data;
                const manager = await tx.user.findFirst({ where: { id: actor.id, isActive: true, roles: { some: { role: { code: 'QUAN_LY' } } } } });
                if (!manager)
                    throw new common_1.ForbiddenException('Quản lý không còn quyền xử lý.');
                await (0, assignment_coordination_1.assertNoCompanyConflict)(tx, actor.id, data.taxCode);
                await (0, company_snapshot_1.lockCompany)(tx, data.taxCode);
                const company = await tx.company.findUnique({ where: { taxCode: data.taxCode } });
                if (!company || company.id !== context.companyId || (0, portal_intake_cycle_1.intakeDigest)((0, company_snapshot_1.companySnapshot)(company)) !== context.companyHash)
                    throw new common_1.ConflictException('Company đã thay đổi; cần lập đối soát mới.');
                await (0, company_snapshot_1.freezeCompanyLoans)(tx, company);
                await tx.company.update({ where: { id: company.id }, data: (0, company_snapshot_1.companySnapshot)(data) });
            }
            await tx.portalIntakeIssue.update({ where: { id: issue.id }, data: { status: 'RESOLVED', resolution: reason, updatedBy: actor.id, context: json({ ...issue.context, decision: body.decision, resolvedAt: new Date().toISOString(), decisionOperationId: body.clientRequestId }) } });
            if (r.assignedTo)
                await tx.internalNotification.createMany({ data: [{ userId: r.assignedTo, requestId: id, title: 'Đối soát doanh nghiệp đã xử lý', message: `Đã ${body.decision === 'APPROVE' ? 'xác nhận' : 'không chấp thuận'} đối soát ${r.reference}. Mở đề nghị để xem căn cứ.` }] });
            return tx.portalRequest.update({ where: { id }, data: { revision: { increment: 1 } }, include: this.include });
        }, { timeout: 15000 });
    }
    async issue(id, body, actor) {
        this.body(body, ['expectedRevision', 'clientRequestId', 'issueId', 'description', 'proposal', 'publicMessage', 'resolution']);
        const resolving = body.issueId !== undefined;
        const description = resolving ? '' : this.text(body.description, 'vấn đề'), proposal = resolving ? '' : this.text(body.proposal, 'phương án/đầu mối xử lý');
        const publicMessage = resolving ? '' : this.text(body.publicMessage, 'thông báo cho doanh nghiệp');
        const resolution = resolving ? this.text(body.resolution, 'kết quả xử lý') : null;
        return this.db.$transaction(async (tx) => {
            const r = await this.lock(tx, id, actor, true);
            if (await this.operation(tx, r, body, actor.id, resolving ? 'RESOLVE_ISSUE' : 'CREATE_ISSUE'))
                return r;
            if (r.status === 'ACCEPTED')
                throw new common_1.ConflictException('Đề nghị đã tiếp nhận; xử lý tại hồ sơ vay.');
            await this.latest(tx, id);
            if (resolving) {
                const issue = await tx.portalIntakeIssue.findFirst({ where: { id: body.issueId, requestId: id, status: 'OPEN' } });
                if (!issue)
                    throw new common_1.NotFoundException('Không có vướng mắc đang mở.');
                if (issue.kind === 'COMPANY_RECONCILIATION')
                    throw new common_1.ConflictException('Cần xử lý bằng thao tác đối soát Company riêng.');
                await tx.portalIntakeIssue.update({ where: { id: issue.id }, data: { status: 'RESOLVED', resolution, updatedBy: actor.id } });
            }
            else
                await tx.portalIntakeIssue.create({ data: { id: (0, node_crypto_1.randomUUID)(), requestId: id, description, proposal, publicMessage, createdBy: actor.id, updatedBy: actor.id } });
            return tx.portalRequest.update({ where: { id }, data: { revision: { increment: 1 } }, include: this.include });
        });
    }
    async assertAccept(tx, r, expectedRevision, submissionId) {
        if ((0, portal_intake_cycle_1.hasPendingCorrection)(r.correctionRequest))
            throw new common_1.ConflictException('Cần xử lý đề nghị xin sửa của doanh nghiệp trước khi tiếp nhận.');
        const s = await this.latest(tx, r.id);
        if (r.revision !== expectedRevision || s.id !== submissionId)
            throw new common_1.ConflictException('Đề nghị hoặc lần gửi đã đổi; tải lại trước khi tiếp nhận.');
        const snapshot = this.snapshot(s);
        const a = (0, portal_approved_policy_1.evaluateIntakeReadiness)((0, portal_approved_policy_1.getApprovedPolicy)(snapshot.policy.version), snapshot.data, snapshot.documents, { phase: 'INTAKE', submittedAt: s.submittedAt });
        if (!a.dataReady)
            throw new common_1.ConflictException('Bản gửi chưa đủ điều kiện tiếp nhận.');
        (0, portal_intake_cycle_1.assertReviewsComplete)((0, portal_intake_cycle_1.intakeChecklist)(snapshot), s.reviews);
        if (await tx.portalIntakeIssue.count({ where: { requestId: r.id, status: 'OPEN' } }))
            throw new common_1.ConflictException('Còn vướng mắc chưa xử lý, chưa thể tiếp nhận.');
        return snapshot;
    }
}
exports.PortalIntakeWorkflow = PortalIntakeWorkflow;
//# sourceMappingURL=portal.intake-workflow.js.map