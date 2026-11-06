"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCOPE_POLICY_VERSIONS = exports.REPRESENTATIVE_DECLARATION_VERSION = exports.APPROVED_MVP_POLICY_VERSION = void 0;
exports.getApprovedPolicy = getApprovedPolicy;
exports.describeApprovedPolicy = describeApprovedPolicy;
exports.isApprovedIntakeVersion = isApprovedIntakeVersion;
exports.getPolicyForScope = getPolicyForScope;
exports.evaluateIntakeReadiness = evaluateIntakeReadiness;
const common_1 = require("@nestjs/common");
const node_util_1 = require("node:util");
const portal_foundation_1 = require("./portal.foundation");
const portal_policy_1 = require("./portal.policy");
exports.APPROVED_MVP_POLICY_VERSION = 'sme-mvp-manufacturing-working-capital-2026-10-26-v1';
exports.REPRESENTATIVE_DECLARATION_VERSION = 'portal-enterprise-submission-v1';
const componentLabels = {
    BALANCE_SHEET: 'Bảng cân đối kế toán', INCOME_STATEMENT: 'Báo cáo kết quả kinh doanh',
    CASH_FLOW_STATEMENT: 'Báo cáo lưu chuyển tiền tệ', NOTES: 'Thuyết minh báo cáo tài chính',
};
const fieldLabels = {
    taxCode: 'Mã số thuế', companyName: 'Tên doanh nghiệp', industry: 'Ngành nghề', establishedYear: 'Năm thành lập',
    annualRevenue: 'Doanh thu năm', charterCapital: 'Vốn điều lệ', representativeName: 'Người đại diện', phone: 'Điện thoại doanh nghiệp',
    address: 'Địa chỉ', loanPurpose: 'Mục đích vay', loanType: 'Loại vay', proposedAmount: 'Số tiền đề nghị', loanTermMonths: 'Thời hạn vay',
    businessScope: 'Phạm vi hoạt động', revenuePeriod: 'Năm báo cáo', 'annualRevenueBasis.documentId': 'Tài liệu nguồn doanh thu',
    'annualRevenueBasis.fullYearCompleted': 'Xác nhận năm báo cáo hoàn thành', 'representative.mode': 'Tư cách người gửi',
    'submissionDeclaration.accepted': 'Xác nhận cam kết', 'submissionDeclaration.version': 'Nội dung cam kết',
    hasExistingDebt: 'Tình trạng dư nợ', 'collateral.mode': 'Đề xuất bảo đảm',
};
function requirement(id, group, documentTypeCode, label, extra = {}) {
    return { id, group, documentTypeCode, label, required: true, stage: 'SUBMIT', step: 4,
        guidance: `Cung cấp ${label.toLocaleLowerCase('vi-VN')} đúng doanh nghiệp và đọc được nội dung.`,
        reviewCriteria: ['Đúng doanh nghiệp đề nghị', 'Đúng loại tài liệu, nội dung đọc được', 'Đối chiếu thông tin liên quan trong đề nghị'], ...extra };
}
const APPROVED_POLICY = {
    version: exports.APPROVED_MVP_POLICY_VERSION, status: 'APPROVED', formVersion: 2,
    scope: 'MANUFACTURING_WORKING_CAPITAL_DEMO', timezone: 'Asia/Ho_Chi_Minh',
    annualPeriodRule: 'PREVIOUS_COMPLETED_CALENDAR_YEAR',
    declaration: { version: exports.REPRESENTATIVE_DECLARATION_VERSION,
        text: 'Tôi được doanh nghiệp cho phép cung cấp hồ sơ này và chịu trách nhiệm về thông tin đã khai.' },
    requiredFields: [...portal_foundation_1.PORTAL_CORE_FIELDS, 'businessScope', 'revenuePeriod', 'annualRevenueBasis.documentId',
        'annualRevenueBasis.fullYearCompleted', 'representative.mode', 'submissionDeclaration.accepted',
        'submissionDeclaration.version', 'hasExistingDebt', 'collateral.mode'],
    requirements: [
        requirement('legal.registration', 'A', 'A_BUSINESS_REGISTRATION', 'Đăng ký doanh nghiệp'),
        requirement('legal.charter', 'A', 'A_CHARTER', 'Điều lệ'),
        requirement('legal.authority', 'A', 'A_REPRESENTATIVE_AUTHORITY', 'Căn cứ thẩm quyền đại diện/ký'),
        requirement('legal.identity', 'A', 'A_REPRESENTATIVE_ID', 'Giấy tờ định danh người đại diện'),
        requirement('legal.authorization', 'A', 'A_AUTHORIZATION', 'Văn bản ủy quyền', { condition: { field: 'representative.mode', equals: 'AUTHORIZED' } }),
        ...portal_foundation_1.FINANCIAL_COMPONENTS.map(component => requirement(`finance.${component}`, 'B', 'B_FINANCIAL_STATEMENTS', componentLabels[component], {
            component, guidance: `Cung cấp ${componentLabels[component].toLocaleLowerCase('vi-VN')} của năm tài chính hoàn thành gần nhất. Có thể dùng một tệp gộp hoặc nhiều tệp.`,
            reviewCriteria: ['Đúng doanh nghiệp và năm báo cáo', `Có nội dung ${componentLabels[component].toLocaleLowerCase('vi-VN')}`, 'Đối chiếu nguồn doanh thu và thông tin tài chính đã khai'],
        })),
        requirement('business.plan', 'C', 'C_PRODUCTION_PLAN', 'Kế hoạch sản xuất kinh doanh'),
        requirement('business.output', 'C', 'C_BUSINESS_CONTRACT', 'Bằng chứng đầu ra', {
            alternatives: ['C_INVOICE', 'C_PURCHASE_ORDER'],
            guidance: 'Cung cấp hợp đồng kinh doanh, hóa đơn hoặc đơn đặt hàng liên quan phương án sản xuất đã khai.',
        }),
        requirement('loan.request', 'D', 'D_LOAN_REQUEST', 'Đề nghị vay vốn'),
        requirement('loan.plan', 'D', 'D_CAPITAL_PLAN', 'Phương án sử dụng vốn'),
        requirement('debt.statement', 'F', 'F_DEBT_STATEMENT', 'Thông tin dư nợ', { condition: { field: 'hasExistingDebt', equals: true } }),
        requirement('later.receivables', 'B', 'B_RECEIVABLES_PAYABLES', 'Chi tiết công nợ phải thu/phải trả', { stage: 'LATER', deferred: true, basis: 'Yêu cầu làm rõ sau tiếp nhận theo phạm vi mô phỏng đã duyệt.' }),
        requirement('later.inventory', 'B', 'B_INVENTORY', 'Chi tiết tồn kho', { stage: 'LATER', deferred: true, basis: 'Yêu cầu làm rõ sau tiếp nhận theo phạm vi mô phỏng đã duyệt.' }),
        requirement('later.recent-finance', 'B', 'B_LATEST_FINANCIAL_STATEMENTS', 'Báo cáo kỳ gần nhất', { stage: 'LATER', deferred: true, basis: 'Yêu cầu làm rõ sau tiếp nhận theo phạm vi mô phỏng đã duyệt.' }),
        requirement('later.materials', 'C', 'C_MATERIAL_CONTRACT', 'Hợp đồng nguyên vật liệu', { stage: 'LATER', deferred: true, basis: 'Yêu cầu làm rõ sau tiếp nhận theo phương án kinh doanh.' }),
        requirement('later.quotation', 'C', 'C_QUOTATION', 'Báo giá', { stage: 'LATER', deferred: true, basis: 'Yêu cầu làm rõ sau tiếp nhận theo phương án kinh doanh.' }),
        requirement('later.cashflow', 'D', 'D_REPAYMENT_CASHFLOW', 'Dòng tiền trả nợ', { stage: 'LATER', deferred: true, basis: 'Chi tiết phục vụ thẩm định sau tiếp nhận.' }),
        requirement('later.collateral-title', 'E', 'E_COLLATERAL_TITLE', 'Hồ sơ quyền đối với tài sản', { stage: 'LATER', condition: { field: 'collateral.mode', equals: 'PROPOSED' }, deferred: true, basis: 'Hồ sơ bảo đảm được kiểm tra sau tiếp nhận, không xác nhận chấp thuận khoản vay.' }),
        requirement('later.collateral-valuation', 'E', 'E_COLLATERAL_VALUATION', 'Thông tin định giá tài sản', { stage: 'LATER', condition: { field: 'collateral.mode', equals: 'PROPOSED' }, deferred: true, basis: 'Thông tin định giá được yêu cầu sau tiếp nhận.' }),
        requirement('later.debt-schedule', 'F', 'F_REPAYMENT_SCHEDULE', 'Lịch trả nợ', { stage: 'LATER', condition: { field: 'hasExistingDebt', equals: true }, deferred: true, basis: 'Lịch chi tiết được yêu cầu sau tiếp nhận.' }),
        requirement('later.bank-statement', 'F', 'F_BANK_STATEMENT', 'Sao kê ngân hàng', { stage: 'LATER', condition: { field: 'hasExistingDebt', equals: true }, deferred: true, basis: 'Sao kê chi tiết được yêu cầu sau tiếp nhận.' }),
    ],
};
function getApprovedPolicy(version = exports.APPROVED_MVP_POLICY_VERSION) {
    if (version !== exports.APPROVED_MVP_POLICY_VERSION) {
        const scope = Object.entries(exports.SCOPE_POLICY_VERSIONS).find(([, v]) => v === version)?.[0];
        if (scope)
            return getPolicyForScope(scope);
    }
    if (version !== exports.APPROVED_MVP_POLICY_VERSION)
        throw new common_1.ConflictException('Không có chính sách mô phỏng được duyệt cho phiên bản này.');
    return structuredClone(APPROVED_POLICY);
}
function describeApprovedPolicy() {
    return { policy: getApprovedPolicy(), canSubmit: false, canAccept: false,
        activationStatus: 'IMPLEMENTATION_INCOMPLETE',
        note: 'Chính sách mô phỏng đã duyệt; chờ hoàn thiện kiểm tra, sửa đề nghị và nghiệm thu trước khi mở nộp.' };
}
exports.SCOPE_POLICY_VERSIONS = {
    MANUFACTURING: 'sme-branch-manufacturing-working-capital-2026-10-31-v1',
    TRADING: 'sme-branch-trading-working-capital-2026-10-31-v1',
    SERVICES: 'sme-branch-services-working-capital-2026-10-31-v1',
};
function isApprovedIntakeVersion(version) { return version === exports.APPROVED_MVP_POLICY_VERSION || Object.values(exports.SCOPE_POLICY_VERSIONS).includes(version); }
function getPolicyForScope(scope) {
    if (!Object.hasOwn(exports.SCOPE_POLICY_VERSIONS, scope))
        throw new common_1.ConflictException('Phạm vi hoạt động chưa được hỗ trợ.');
    const p = structuredClone(APPROVED_POLICY);
    p.version = exports.SCOPE_POLICY_VERSIONS[scope];
    p.scope = scope + '_WORKING_CAPITAL';
    if (scope !== 'MANUFACTURING') {
        p.requirements = p.requirements.filter(r => !['business.plan', 'business.output', 'later.materials', 'later.quotation'].includes(r.id));
        const trade = scope === 'TRADING';
        p.requirements.push(requirement('business.plan', 'C', trade ? 'C_TRADING_PLAN' : 'C_SERVICE_PLAN', trade ? 'Kế hoạch mua và bán hàng' : 'Kế hoạch thực hiện dịch vụ và chi phí'));
        if (trade)
            p.requirements.push(requirement('business.output', 'C', 'C_BUSINESS_CONTRACT', 'Căn cứ đầu ra thương mại', { alternatives: ['C_PURCHASE_ORDER', 'C_INVOICE'] }));
        else {
            p.requiredFields.push('serviceProofMode');
            p.requirements.push(requirement('service.contract', 'C', 'C_SERVICE_CONTRACT', 'Hợp đồng hoặc đơn đặt dịch vụ', { alternatives: ['C_SERVICE_ORDER'], condition: { field: 'serviceProofMode', equals: 'CONTRACT_OR_ORDER' } }));
            p.requirements.push(requirement('service.acceptance', 'C', 'C_SERVICE_ACCEPTANCE', 'Biên bản nghiệm thu dịch vụ', { condition: { field: 'serviceProofMode', equals: 'ACCEPTANCE_INVOICE' } }));
            p.requirements.push(requirement('service.invoice', 'C', 'C_INVOICE', 'Hóa đơn dịch vụ', { condition: { field: 'serviceProofMode', equals: 'ACCEPTANCE_INVOICE' } }));
        }
    }
    return p;
}
function atPath(data, field) {
    let value = data;
    for (const part of field.split('.')) {
        if (!value || typeof value !== 'object' || !Object.hasOwn(value, part))
            return undefined;
        value = value[part];
    }
    return value;
}
function annualPeriodAt(submittedAt) {
    const instant = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
    if (!Number.isFinite(instant.getTime()))
        throw new common_1.BadRequestException('Thời điểm gửi không hợp lệ.');
    return String(new Date(instant.getTime() + 7 * 60 * 60 * 1000).getUTCFullYear() - 1);
}
function evaluateIntakeReadiness(policy, data, documents, options) {
    const registered = getApprovedPolicy(policy?.version);
    if (!policy || !(0, node_util_1.isDeepStrictEqual)(policy, registered))
        throw new common_1.ConflictException('Chính sách đánh giá khác bản được duyệt trên máy chủ.');
    if (!options || !['SUBMIT', 'INTAKE'].includes(options.phase) || options.submittedAt == null)
        throw new common_1.BadRequestException('Ngữ cảnh đánh giá không hợp lệ.');
    const annualPeriod = annualPeriodAt(options.submittedAt);
    const resolved = { ...registered,
        requirements: registered.requirements.map(item => item.component ? { ...item, periods: [annualPeriod] } : item) };
    const evaluation = (0, portal_policy_1.evaluatePolicy)(resolved, data, documents, options.phase);
    const issues = [];
    const missingFields = [];
    function issue(path, code, message, missing = false) {
        const step = ['loanPurpose', 'loanType', 'proposedAmount', 'loanTermMonths', 'hasExistingDebt', 'collateral.mode', 'collateral.description'].includes(path) ? 2
            : path.startsWith('annualRevenueBasis') ? 4 : path.startsWith('submissionDeclaration') ? 5 : 1;
        issues.push({ path, code, step, message });
        if (missing && !missingFields.includes(path))
            missingFields.push(path);
    }
    for (const field of registered.requiredFields) {
        const value = atPath(data, field);
        if (value === undefined || value === null || (typeof value === 'string' && !value.trim()))
            issue(field, 'MISSING_DATA', `Cần cung cấp: ${fieldLabels[field] ?? field}.`, true);
    }
    const scope = Object.entries(exports.SCOPE_POLICY_VERSIONS).find(([, v]) => v === registered.version)?.[0] ?? 'MANUFACTURING';
    if (atPath(data, 'businessScope') !== scope)
        issue('businessScope', 'OUTSIDE_SCOPE', 'Phạm vi hoạt động không khớp chính sách của đề nghị.');
    if (scope === 'SERVICES' && !['CONTRACT_OR_ORDER', 'ACCEPTANCE_INVOICE'].includes(String(atPath(data, 'serviceProofMode'))))
        issue('serviceProofMode', 'SERVICE_PROOF', 'Chọn căn cứ doanh thu dịch vụ.');
    if (registered.version !== exports.APPROVED_MVP_POLICY_VERSION && Number(atPath(data, 'proposedAmount')) > 10000000000)
        issue('proposedAmount', 'BRANCH_LIMIT', 'Cổng này tiếp nhận đề nghị vay tối đa 10 tỷ đồng.');
    if (atPath(data, 'loanType') !== 'VAY_VON_LUU_DONG')
        issue('loanType', 'OUTSIDE_SCOPE', 'Chính sách mô phỏng này chỉ áp dụng vay vốn lưu động.');
    if (atPath(data, 'revenuePeriod') !== annualPeriod)
        issue('revenuePeriod', 'ANNUAL_PERIOD', `Cần báo cáo năm ${annualPeriod}; không tự quy đổi số liệu tháng/quý.`);
    const establishedYear = atPath(data, 'establishedYear');
    if (typeof establishedYear === 'number' && establishedYear > Number(annualPeriod))
        issue('revenuePeriod', 'ANNUAL_BEFORE_ESTABLISHMENT', 'Năm báo cáo không được trước năm thành lập; chưa có dữ liệu năm phù hợp thì tiếp tục lưu nháp.');
    if (atPath(data, 'annualRevenueBasis.fullYearCompleted') !== true)
        issue('annualRevenueBasis.fullYearCompleted', 'ANNUAL_INCOMPLETE', 'Cần xác nhận dữ liệu năm đã hoàn thành; chưa có thì tiếp tục lưu nháp.');
    const superseded = new Set(documents.map(document => document.supersedesId).filter(Boolean));
    const source = documents.find(document => document.id === atPath(data, 'annualRevenueBasis.documentId') && !document.withdrawnAt
        && !superseded.has(document.id) && document.documentGroup === 'B'
        && (0, portal_foundation_1.validateCoverage)(document.documentGroup, document.coverage).some(entry => entry.documentTypeCode === 'B_FINANCIAL_STATEMENTS'
            && entry.period === annualPeriod && entry.components?.includes('INCOME_STATEMENT')));
    if (!source)
        issue('annualRevenueBasis.documentId', 'ANNUAL_SOURCE', 'Chọn BCTC nguồn đang sử dụng, thuộc đề nghị, đúng năm và có phần kết quả kinh doanh.');
    if (atPath(data, 'representative.mode') === 'AUTHORIZED' && !String(atPath(data, 'representative.name') ?? '').trim())
        issue('representative.name', 'MISSING_DATA', 'Cần khai tên người thao tác theo ủy quyền.', true);
    const collateralMode = atPath(data, 'collateral.mode');
    if (!['PROPOSED', 'NONE_REQUESTED'].includes(String(collateralMode)))
        issue('collateral.mode', 'UNDECIDED', 'Cần khai rõ có hoặc không đề xuất bảo đảm; chưa xác định thì giữ nháp.');
    if (collateralMode === 'PROPOSED' && !String(atPath(data, 'collateral.description') ?? '').trim())
        issue('collateral.description', 'MISSING_DATA', 'Cần mô tả tài sản bảo đảm dự kiến.', true);
    if (atPath(data, 'submissionDeclaration.accepted') !== true)
        issue('submissionDeclaration.accepted', 'DECLARATION_REQUIRED', 'Cần xác nhận cam kết trước khi gửi.');
    if (atPath(data, 'submissionDeclaration.version') !== registered.declaration.version)
        issue('submissionDeclaration.version', 'DECLARATION_VERSION', 'Cần xác nhận nội dung cam kết đang áp dụng.');
    const requirements = evaluation.requirements.map((item, index) => ({ ...item, ...resolved.requirements[index],
        state: !item.applies ? 'NOT_APPLICABLE' : !item.due ? 'LATER' : item.satisfied ? 'PROVIDED_PENDING_REVIEW' : 'MISSING' }));
    return { policyVersion: registered.version, annualPeriod, phase: options.phase, missingFields,
        missingDocuments: evaluation.missing, formErrors: evaluation.formErrors, issues, requirements,
        dataReady: missingFields.length === 0 && issues.length === 0 && evaluation.missing.length === 0 && evaluation.formErrors.length === 0,
        canSubmit: false, canAccept: false, businessValidity: 'NOT_REVIEWED', creditDecision: null,
        note: 'Kiểm tra mức cung cấp theo khai báo; CBTD còn phải đối chiếu nội dung. Chưa mở nộp hoặc tiếp nhận theo chính sách này.' };
}
//# sourceMappingURL=portal.approved-policy.js.map