"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPANY_FIELDS = void 0;
exports.companySnapshot = companySnapshot;
exports.companyForLoan = companyForLoan;
exports.withLoanCompany = withLoanCompany;
exports.lockCompany = lockCompany;
exports.freezeCompanyLoans = freezeCompanyLoans;
exports.COMPANY_FIELDS = ['taxCode', 'companyName', 'industry', 'establishedYear', 'annualRevenue', 'charterCapital', 'representativeName', 'phone', 'address'];
function companySnapshot(company) {
    return { ...Object.fromEntries(exports.COMPANY_FIELDS.map(k => [k, ['annualRevenue', 'charterCapital'].includes(k) ? String(company[k]) : company[k]])),
        ...(company.id ? { id: company.id } : {}), ...(company.createdAt ? { createdAt: new Date(company.createdAt).toISOString() } : {}), ...(company.updatedAt ? { updatedAt: new Date(company.updatedAt).toISOString() } : {}) };
}
function companyForLoan(loan, fallback) {
    return { ...(fallback ?? loan.company), ...(loan.companySnapshot ?? {}) };
}
function withLoanCompany(loan) {
    return { ...loan, company: companyForLoan(loan) };
}
async function lockCompany(tx, taxCode) {
    await tx.$queryRaw `SELECT pg_advisory_xact_lock(hashtext(${taxCode}))::text`;
}
async function freezeCompanyLoans(tx, company) {
    const snapshot = JSON.stringify(companySnapshot(company));
    await tx.$executeRaw `UPDATE loan_applications SET company_snapshot=${snapshot}::jsonb WHERE company_id=${company.id} AND company_snapshot IS NULL`;
}
//# sourceMappingURL=company-snapshot.js.map