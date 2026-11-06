"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uuid = uuid;
exports.createMetadata = createMetadata;
exports.metadata = metadata;
exports.revision = revision;
exports.replay = replay;
exports.heads = heads;
exports.respond = respond;
exports.review = review;
exports.waitingOn = waitingOn;
exports.safeView = safeView;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const portal_foundation_1 = require("../portal/portal.foundation");
function uuid(value) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
        throw new common_1.BadRequestException('Cần mã thao tác UUID hợp lệ.');
}
function createMetadata(items, clientRequestId) {
    uuid(clientRequestId);
    if (!Array.isArray(items) || !items.length || items.length > 60)
        throw new common_1.BadRequestException('Cần 1 đến 60 mục bổ sung.');
    const seen = new Set();
    const result = items.map(input => {
        if (!input || Object.keys(input).some(k => !['documentGroup', 'documentTypeCode', 'period', 'reason'].includes(k)))
            throw new common_1.BadRequestException('Mục bổ sung không hợp lệ.');
        (0, portal_foundation_1.validateCoverage)(input.documentGroup, [{ documentTypeCode: input.documentTypeCode, ...(input.period === undefined ? {} : { period: input.period }) }]);
        if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 2000)
            throw new common_1.BadRequestException('Cần lý do bổ sung.');
        const key = JSON.stringify([input.documentGroup, input.documentTypeCode, input.period]);
        if (seen.has(key))
            throw new common_1.BadRequestException('Mục bổ sung trùng nhau.');
        seen.add(key);
        return { id: (0, node_crypto_1.randomUUID)(), documentGroup: input.documentGroup, documentTypeCode: input.documentTypeCode, ...(input.period === undefined ? {} : { period: input.period }), reason: input.reason.trim(), status: 'PENDING' };
    });
    return { version: 1, revision: 0, createId: clientRequestId, createHash: '', items: result, files: [], responses: [], events: [{ type: 'REQUESTED', at: new Date().toISOString() }], operations: [] };
}
function metadata(request) {
    const m = request.portalSupplement;
    if (!m || m.version !== 1 || !Array.isArray(m.items))
        throw new common_1.BadRequestException('Yêu cầu bổ sung này dùng quy trình cũ.');
    return structuredClone(m);
}
function revision(m, value) {
    if (!Number.isSafeInteger(value) || value !== m.revision)
        throw new common_1.ConflictException('Dữ liệu đã thay đổi. Vui lòng tải lại.');
}
function replay(m, id, kind, hash) {
    uuid(id);
    const old = m.operations.find(o => o.id === id);
    if (old && (old.kind !== kind || old.hash !== hash))
        throw new common_1.ConflictException('Mã thao tác đã được dùng cho nội dung khác.');
    return !!old;
}
function heads(m) { const superseded = new Set(m.files.map(f => f.supersedesId).filter(Boolean)); return m.files.filter(f => !superseded.has(f.id)); }
function respond(m, documentIds) {
    if (!Array.isArray(documentIds) || documentIds.some(id => typeof id !== 'string') || new Set(documentIds).size !== documentIds.length)
        throw new common_1.BadRequestException('Danh sách tệp không hợp lệ.');
    const pending = m.items.filter(i => ['PENDING', 'REPLACE_REQUIRED'].includes(i.status));
    const manifest = heads(m).filter(f => pending.some(i => i.id === f.itemId) && !f.submittedAt);
    if (!pending.length || pending.some(i => !manifest.some(f => f.itemId === i.id)) || JSON.stringify([...documentIds].sort()) !== JSON.stringify(manifest.map(f => f.id).sort()))
        throw new common_1.ConflictException('Cần gửi chính xác tất cả tệp hiện hành của các mục đang chờ bổ sung.');
    const at = new Date().toISOString();
    for (const f of manifest)
        f.submittedAt = at;
    for (const i of pending)
        i.status = 'SUBMITTED';
    m.responses.push({ id: (0, node_crypto_1.randomUUID)(), at, documentIds: [...documentIds] });
    m.events.push({ type: 'RESPONDED', at });
}
function review(m, itemId, body) {
    const item = m.items.find(i => i.id === itemId);
    if (!item || item.status !== 'SUBMITTED')
        throw new common_1.ConflictException('Chỉ kiểm tra mục đã được doanh nghiệp gửi.');
    if (typeof body.accepted !== 'boolean' || typeof body.message !== 'string' || body.message.length > 2000 || (!body.accepted && !body.message.trim()))
        throw new common_1.BadRequestException('Kết quả hoặc lý do kiểm tra không hợp lệ.');
    const at = new Date().toISOString();
    item.status = body.accepted ? 'ACCEPTED' : 'REPLACE_REQUIRED';
    item.message = body.message.trim();
    item.reviewedAt = at;
    m.events.push({ type: item.status, at, itemId, message: item.message });
}
function waitingOn(request) {
    const items = request.portalSupplement?.items;
    if (!Array.isArray(items) || !items.length)
        return 'ENTERPRISE';
    return items.some((i) => i.status === 'PENDING' || i.status === 'REPLACE_REQUIRED') ? 'ENTERPRISE' : 'BANK';
}
function safeView(r) {
    const m = r.portalSupplement;
    const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));
    return { ...pick(r, ['id', 'applicationId', 'requestContent', 'status', 'requestedAt', 'deadlineAt', 'resolvedAt']), revision: m?.revision ?? 0,
        items: (m?.items ?? []).map((i) => pick(i, ['id', 'documentGroup', 'documentTypeCode', 'period', 'reason', 'status', 'message', 'reviewedAt'])),
        files: (m?.files ?? []).map((f) => pick(f, ['id', 'itemId', 'fileName', 'fileSize', 'mimeType', 'version', 'supersedesId', 'uploadedAt', 'submittedAt'])),
        events: (m?.events ?? []).map((e) => pick(e, ['type', 'at', 'itemId', 'message'])) };
}
//# sourceMappingURL=portal-supplement.js.map