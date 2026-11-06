"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intakeDigest = exports.hasPendingCorrection = exports.isIntakeEditable = exports.intakeCycleEnabled = void 0;
exports.intakeChecklist = intakeChecklist;
exports.carryReviews = carryReviews;
exports.assertReviewsComplete = assertReviewsComplete;
exports.submissionChanges = submissionChanges;
exports.approvedCompanyDifferences = approvedCompanyDifferences;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const portal_snapshot_1 = require("./portal.snapshot");
const intakeCycleEnabled = () => process.env.PORTAL_V2_ROLLOUT_ENABLED === 'true' || process.env.PORTAL_V2_INTAKE_ENABLED === 'true' && process.env.PORTAL_FOUNDATION_PREVIEW === 'true' && ['development', 'test'].includes(process.env.NODE_ENV ?? '');
exports.intakeCycleEnabled = intakeCycleEnabled;
const isIntakeEditable = (r) => r.status === 'DRAFT' || (r.formVersion === 2 && r.status === 'RETURNED');
exports.isIntakeEditable = isIntakeEditable;
const hasPendingCorrection = (value) => !!value && (!value.status || value.status === 'PENDING');
exports.hasPendingCorrection = hasPendingCorrection;
const dependencies = {
    A: ['representativeName', 'representative', 'establishedYear', 'address', 'companyType'],
    B: ['annualRevenue', 'annualRevenueBasis', 'revenuePeriod', 'charterCapital', 'establishedYear'],
    C: ['serviceProofMode', 'businessScope', 'industry', 'loanPurpose', 'capitalPlan'],
    D: ['loanType', 'loanPurpose', 'proposedAmount', 'loanTermMonths', 'capitalPlan', 'neededAt'],
    E: ['collateral'], F: ['hasExistingDebt'],
};
function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
}
const intakeDigest = (value) => (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(canonical(value))).digest('hex');
exports.intakeDigest = intakeDigest;
function intakeChecklist(snapshot) {
    return snapshot.checklist.filter(i => i.required && i.applies && i.due).map(item => {
        const accepted = [item.documentTypeCode, ...(item.alternatives ?? [])];
        const documents = snapshot.documents.filter(d => d.documentGroup === item.group && d.coverage?.some((c) => accepted.includes(c.documentTypeCode) && (!item.periods || item.periods.includes(c.period)) && (!item.component || c.components?.includes(item.component))));
        const fields = ['taxCode', 'companyName', ...(dependencies[item.group] ?? [])];
        const data = Object.fromEntries(fields.map(key => [key, snapshot.data[key] ?? null]));
        const evidence = documents.map(d => ({ id: d.id, sha256: d.sha256, coverage: d.coverage })).sort((a, b) => a.id.localeCompare(b.id));
        return { id: item.id, label: item.label ?? item.id, group: item.group, documentIds: evidence.map(d => d.id),
            guidance: item.guidance, reviewCriteria: item.reviewCriteria,
            fingerprint: (0, exports.intakeDigest)({ item, data, evidence }) };
    });
}
function carryReviews(previous, next, submissionId) {
    return previous.filter(r => r.decision === 'ACCEPTED' && next.some(i => i.id === r.id && i.fingerprint === r.fingerprint))
        .map(r => ({ ...structuredClone(r), ...(submissionId ? { carriedFrom: submissionId } : {}) }));
}
function assertReviewsComplete(items, reviews) {
    if (!items.length || items.some(i => !i.documentIds.length || !reviews.some(r => r.id === i.id && r.fingerprint === i.fingerprint && r.decision === 'ACCEPTED')))
        throw new common_1.ConflictException('Các mục bắt buộc chưa được CBTD kiểm tra đạt trên đúng lần gửi.');
}
function submissionChanges(previous, next) {
    const a = previous?.data ?? {}, b = next.data;
    return { fields: [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !(0, portal_snapshot_1.sameJson)(a[k] ?? null, b[k] ?? null)).sort(),
        addedDocuments: next.documents.filter(d => !previous?.documents.some(p => p.id === d.id)).map(d => d.id),
        removedDocuments: (previous?.documents ?? []).filter(d => !next.documents.some(n => n.id === d.id)).map(d => d.id) };
}
function approvedCompanyDifferences(data, company) {
    const numeric = ['establishedYear', 'annualRevenue', 'charterCapital'];
    return ['taxCode', 'companyName', 'industry', ...numeric, 'representativeName', 'phone', 'address'].filter(k => numeric.includes(k) ? Number(company[k]) !== data[k] : company[k] !== data[k]);
}
//# sourceMappingURL=portal.intake-cycle.js.map