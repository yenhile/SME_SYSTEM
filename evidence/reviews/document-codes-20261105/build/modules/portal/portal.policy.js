"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePolicy = evaluatePolicy;
exports.resolveTestPolicy = resolveTestPolicy;
const common_1 = require("@nestjs/common");
const portal_foundation_1 = require("./portal.foundation");
const portal_readiness_1 = require("./portal.readiness");
function invalidPolicy() { throw new common_1.BadRequestException('Định nghĩa policy không hợp lệ.'); }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function safePath(value) {
    return nonempty(value) && /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/.test(value)
        && !value.split('.').some(part => ['__proto__', 'prototype', 'constructor'].includes(part));
}
function atPath(data, field) {
    let value = data;
    for (const key of field.split('.')) {
        if (!value || typeof value !== 'object' || !Object.hasOwn(value, key))
            return undefined;
        value = value[key];
    }
    return value;
}
function validatePolicy(policy) {
    if (!policy || typeof policy !== 'object' || !nonempty(policy.version) || !['APPROVED', 'TEST_ONLY'].includes(policy.status) || policy.formVersion !== 2
        || !Array.isArray(policy.requiredFields) || policy.requiredFields.some(field => !safePath(field))
        || new Set(policy.requiredFields).size !== policy.requiredFields.length || !Array.isArray(policy.requirements))
        invalidPolicy();
    if (policy.readinessVersion !== undefined && policy.readinessVersion !== 'MVP1')
        invalidPolicy();
    const catalog = (0, portal_foundation_1.getFormConfig)().groups;
    const ids = new Set();
    for (const item of policy.requirements) {
        if (!item || typeof item !== 'object' || !nonempty(item.id) || ids.has(item.id) || typeof item.required !== 'boolean'
            || !['SUBMIT', 'INTAKE', 'LATER'].includes(item.stage))
            invalidPolicy();
        ids.add(item.id);
        const codes = catalog.find(group => group.code === item.group)?.documentTypes.map(type => type.code);
        if (!codes?.includes(item.documentTypeCode))
            invalidPolicy();
        if (item.periods !== undefined && (!Array.isArray(item.periods) || !item.periods.length || item.periods.some(period => !nonempty(period)) || new Set(item.periods).size !== item.periods.length))
            invalidPolicy();
        if (item.periods)
            for (const period of item.periods)
                (0, portal_foundation_1.validateCoverage)(item.group, [{ documentTypeCode: item.documentTypeCode, period }]);
        if (item.alternatives !== undefined && (!Array.isArray(item.alternatives) || item.alternatives.some(code => !codes.includes(code))
            || new Set(item.alternatives).size !== item.alternatives.length))
            invalidPolicy();
        if (item.condition !== undefined && (!item.condition || !safePath(item.condition.field) || !['string', 'boolean'].includes(typeof item.condition.equals)))
            invalidPolicy();
        if (item.basis !== undefined && !nonempty(item.basis))
            invalidPolicy();
        if (item.component !== undefined && (item.group !== 'B' || item.documentTypeCode !== 'B_FINANCIAL_STATEMENTS'
            || !portal_foundation_1.FINANCIAL_COMPONENTS.includes(item.component)))
            invalidPolicy();
        if (item.deferred !== undefined && typeof item.deferred !== 'boolean')
            invalidPolicy();
        if (item.deferred && (item.stage === 'SUBMIT' || !nonempty(item.basis)))
            invalidPolicy();
    }
}
function evaluatePolicy(policy, data, documents, phase) {
    validatePolicy(policy);
    if (!['SUBMIT', 'INTAKE'].includes(phase) || !Array.isArray(documents))
        invalidPolicy();
    const formErrors = [];
    try {
        (0, portal_foundation_1.validateDraftV2)(data);
    }
    catch (error) {
        if (!(error instanceof common_1.BadRequestException))
            throw error;
        formErrors.push(error.message);
    }
    if (policy.readinessVersion === 'MVP1')
        formErrors.push(...(0, portal_readiness_1.assessReadiness)((data ?? {}), documents).issues.map(issue => issue.message));
    if (phase === 'SUBMIT')
        for (const field of policy.requiredFields) {
            const value = atPath(data, field);
            if (value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)
                || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length))
                formErrors.push(`Thiếu thông tin: ${field}`);
        }
    const ids = new Set();
    for (const document of documents) {
        if (!document || !nonempty(document.id) || ids.has(document.id))
            throw new common_1.BadRequestException('Danh sách tài liệu không hợp lệ.');
        ids.add(document.id);
    }
    const superseded = new Set(documents.map(document => document.supersedesId).filter(Boolean));
    const coverage = documents.filter(document => !document.withdrawnAt && !superseded.has(document.id))
        .flatMap(document => (0, portal_foundation_1.validateCoverage)(document.documentGroup, document.coverage).map(item => ({ ...item, group: document.documentGroup })));
    const missing = [];
    const requirements = policy.requirements.map(item => {
        if (item.required && item.condition && atPath(data, item.condition.field) === undefined) {
            const message = `Thiếu thông tin điều kiện: ${item.condition.field}`;
            if (!formErrors.includes(message))
                formErrors.push(message);
        }
        const applies = item.condition === undefined || atPath(data, item.condition.field) === item.condition.equals;
        const due = item.stage === 'SUBMIT' || (phase === 'INTAKE' && item.stage === 'INTAKE');
        const accepted = [item.documentTypeCode, ...(item.alternatives || [])];
        const periods = item.periods || [undefined];
        const unmet = periods.filter(period => !coverage.some(entry => entry.group === item.group && accepted.includes(entry.documentTypeCode)
            && (period === undefined || entry.period === period) && (item.component === undefined || entry.components?.includes(item.component))));
        if (item.required && applies && due)
            for (const period of unmet)
                missing.push(period === undefined ? item.id : `${item.id}:${period}`);
        return { ...structuredClone(item), applies, due, satisfied: unmet.length === 0 };
    });
    return { requirements, missing, formErrors };
}
function resolveTestPolicy(context) {
    const unavailable = () => { throw new common_1.ConflictException('Chờ chốt chính sách V2. Submit/Accept chỉ khả dụng với policy test trong môi trường cách ly.'); };
    if (process.env.NODE_ENV !== 'test' || process.env.PORTAL_V2_SUBMIT_ENABLED !== 'true' || context?.mode !== 'isolated-test'
        || context.policy?.status !== 'TEST_ONLY' || !context.policy?.version?.startsWith('TEST-'))
        return unavailable();
    let target;
    try {
        target = new URL(process.env.DATABASE_URL || '');
    }
    catch {
        return unavailable();
    }
    if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['localhost', '127.0.0.1'].includes(target.hostname)
        || target.pathname !== '/sme_loan' || target.searchParams.getAll('schema').length !== 1
        || !/^portal_v2_it_[a-z0-9_]+$/.test(target.searchParams.get('schema') || ''))
        return unavailable();
    validatePolicy(context.policy);
    return structuredClone(context.policy);
}
//# sourceMappingURL=portal.policy.js.map