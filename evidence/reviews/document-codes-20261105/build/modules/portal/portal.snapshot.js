"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sameJson = sameJson;
exports.createV2Snapshot = createV2Snapshot;
exports.readV2Snapshot = readV2Snapshot;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
function sameJson(a, b) { return canonical(a) === canonical(b); }
function canonical(value) {
    const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, sort(v[k])])) : v;
    return JSON.stringify(sort(value));
}
function createV2Snapshot(request, policy, checklist, documents, now) {
    const core = { snapshotVersion: 2, requestId: request.id, formVersion: 2, checklistVersion: policy.version, revision: request.revision, submittedAt: now.toISOString(), data: request.data, policy, checklist,
        documents: documents.map(d => ({ id: d.id, documentGroup: d.documentGroup, fileName: d.fileName, fileSize: d.fileSize, mimeType: d.mimeType, uploadedAt: new Date(d.uploadedAt).toISOString(), coverage: d.coverage, version: d.version, contentHash: d.contentHash ?? null, sha256: d.sha256 })),
        audit: { event: 'PORTAL_REQUEST_SUBMITTED', actorAccountId: request.accountId, requestId: request.id, at: now.toISOString() } };
    const copy = JSON.parse(JSON.stringify(core));
    return { ...copy, integrity: (0, node_crypto_1.createHash)('sha256').update(canonical(copy)).digest('hex') };
}
function readV2Snapshot(request) {
    const s = request.checklistSnapshot;
    const fail = () => { throw new common_1.ConflictException('Snapshot đề nghị không đồng nhất. Chưa thể tiếp nhận; cần kiểm tra dữ liệu.'); };
    if (!s || s.snapshotVersion !== 2 || s.formVersion !== 2 || s.requestId !== request.id || s.revision !== request.revision || s.checklistVersion !== request.checklistVersion
        || !s.policy || s.policy.version !== s.checklistVersion || !Array.isArray(s.documents) || s.documents.some(d => !d || typeof d.id !== 'string' || !d.id) || new Set(s.documents.map(d => d.id)).size !== s.documents.length
        || !s.audit || s.audit.actorAccountId !== request.accountId || !sameJson(s.data, request.data))
        return fail();
    const { integrity, ...core } = s;
    if (typeof integrity !== 'string' || (0, node_crypto_1.createHash)('sha256').update(canonical(core)).digest('hex') !== integrity
        || !request.submittedAt || new Date(request.submittedAt).toISOString() !== s.submittedAt)
        return fail();
    return s;
}
//# sourceMappingURL=portal.snapshot.js.map