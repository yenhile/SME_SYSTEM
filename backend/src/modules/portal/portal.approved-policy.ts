import { BadRequestException, ConflictException } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { FINANCIAL_COMPONENTS, PORTAL_CORE_FIELDS, validateCoverage, type FinancialComponent } from './portal.foundation';
import { evaluatePolicy, type PolicyDocument, type PolicyRequirement, type PortalPolicy } from './portal.policy';

export const APPROVED_MVP_POLICY_VERSION = 'sme-mvp-manufacturing-working-capital-2026-10-26-v1';
export const REPRESENTATIVE_DECLARATION_VERSION = 'portal-enterprise-submission-v1';

interface IntakeRequirement extends PolicyRequirement {
  label: string;
  guidance: string;
  reviewCriteria: string[];
  step: 4;
}

export interface ApprovedPortalPolicy extends PortalPolicy {
  status: 'APPROVED';
  scope: 'MANUFACTURING_WORKING_CAPITAL_DEMO';
  annualPeriodRule: 'PREVIOUS_COMPLETED_CALENDAR_YEAR';
  timezone: 'Asia/Ho_Chi_Minh';
  declaration: { version: string; text: string };
  requirements: IntakeRequirement[];
}

const componentLabels: Record<FinancialComponent, string> = {
  BALANCE_SHEET: 'Bảng cân đối kế toán', INCOME_STATEMENT: 'Báo cáo kết quả kinh doanh',
  CASH_FLOW_STATEMENT: 'Báo cáo lưu chuyển tiền tệ', NOTES: 'Thuyết minh báo cáo tài chính',
};
const fieldLabels: Record<string, string> = {
  taxCode: 'Mã số thuế', companyName: 'Tên doanh nghiệp', industry: 'Ngành nghề', establishedYear: 'Năm thành lập',
  annualRevenue: 'Doanh thu năm', charterCapital: 'Vốn điều lệ', representativeName: 'Người đại diện', phone: 'Điện thoại doanh nghiệp',
  address: 'Địa chỉ', loanPurpose: 'Mục đích vay', loanType: 'Loại vay', proposedAmount: 'Số tiền đề nghị', loanTermMonths: 'Thời hạn vay',
  businessScope: 'Phạm vi hoạt động', revenuePeriod: 'Năm báo cáo', 'annualRevenueBasis.documentId': 'Tài liệu nguồn doanh thu',
  'annualRevenueBasis.fullYearCompleted': 'Xác nhận năm báo cáo hoàn thành', 'representative.mode': 'Tư cách người gửi',
  'submissionDeclaration.accepted': 'Xác nhận cam kết', 'submissionDeclaration.version': 'Nội dung cam kết',
  hasExistingDebt: 'Tình trạng dư nợ', 'collateral.mode': 'Đề xuất bảo đảm',
};

function requirement(id: string, group: string, documentTypeCode: string, label: string,
  extra: Partial<IntakeRequirement> = {}): IntakeRequirement {
  return { id, group, documentTypeCode, label, required: true, stage: 'SUBMIT', step: 4,
    guidance: `Cung cấp ${label.toLocaleLowerCase('vi-VN')} đúng doanh nghiệp và đọc được nội dung.`,
    reviewCriteria: ['Đúng doanh nghiệp đề nghị', 'Đúng loại tài liệu, nội dung đọc được', 'Đối chiếu thông tin liên quan trong đề nghị'], ...extra };
}

const APPROVED_POLICY: ApprovedPortalPolicy = {
  version: APPROVED_MVP_POLICY_VERSION, status: 'APPROVED', formVersion: 2,
  scope: 'MANUFACTURING_WORKING_CAPITAL_DEMO', timezone: 'Asia/Ho_Chi_Minh',
  annualPeriodRule: 'PREVIOUS_COMPLETED_CALENDAR_YEAR',
  declaration: { version: REPRESENTATIVE_DECLARATION_VERSION,
    text: 'Tôi được doanh nghiệp cho phép cung cấp hồ sơ này và chịu trách nhiệm về thông tin đã khai.' },
  requiredFields: [...PORTAL_CORE_FIELDS, 'businessScope', 'revenuePeriod', 'annualRevenueBasis.documentId',
    'annualRevenueBasis.fullYearCompleted', 'representative.mode', 'submissionDeclaration.accepted',
    'submissionDeclaration.version', 'hasExistingDebt', 'collateral.mode'],
  requirements: [
    requirement('legal.registration', 'A', 'A_BUSINESS_REGISTRATION', 'Đăng ký doanh nghiệp'),
    requirement('legal.charter', 'A', 'A_CHARTER', 'Điều lệ'),
    requirement('legal.authority', 'A', 'A_REPRESENTATIVE_AUTHORITY', 'Căn cứ thẩm quyền đại diện/ký'),
    requirement('legal.identity', 'A', 'A_REPRESENTATIVE_ID', 'Giấy tờ định danh người đại diện'),
    requirement('legal.authorization', 'A', 'A_AUTHORIZATION', 'Văn bản ủy quyền', { condition: { field: 'representative.mode', equals: 'AUTHORIZED' } }),
    ...FINANCIAL_COMPONENTS.map(component => requirement(`finance.${component}`, 'B', 'B_FINANCIAL_STATEMENTS', componentLabels[component], {
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

/** Policy approval is independent from activation. Never resolve a policy supplied by the browser. */
export function getApprovedPolicy(version = APPROVED_MVP_POLICY_VERSION): ApprovedPortalPolicy {
  if (version !== APPROVED_MVP_POLICY_VERSION) throw new ConflictException('Không có chính sách mô phỏng được duyệt cho phiên bản này.');
  return structuredClone(APPROVED_POLICY);
}

export function describeApprovedPolicy() {
  return { policy: getApprovedPolicy(), canSubmit: false as const, canAccept: false as const,
    activationStatus: 'IMPLEMENTATION_INCOMPLETE' as const,
    note: 'Chính sách mô phỏng đã duyệt; chờ hoàn thiện kiểm tra, sửa đề nghị và nghiệm thu trước khi mở nộp.' };
}

function atPath(data: unknown, field: string): unknown {
  let value: any = data;
  for (const part of field.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined;
    value = value[part];
  }
  return value;
}

function annualPeriodAt(submittedAt: Date | string): string {
  const instant = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
  if (!Number.isFinite(instant.getTime())) throw new BadRequestException('Thời điểm gửi không hợp lệ.');
  // The approved calendar is Vietnamese calendar years, not the execution host's timezone.
  return String(new Date(instant.getTime() + 7 * 60 * 60 * 1000).getUTCFullYear() - 1);
}

export function evaluateIntakeReadiness(policy: ApprovedPortalPolicy, data: unknown, documents: PolicyDocument[],
  options: { phase: 'SUBMIT' | 'INTAKE'; submittedAt: Date | string }) {
  const registered = getApprovedPolicy(policy?.version);
  if (!policy || !isDeepStrictEqual(policy, registered)) throw new ConflictException('Chính sách đánh giá khác bản được duyệt trên máy chủ.');
  if (!options || !['SUBMIT', 'INTAKE'].includes(options.phase) || options.submittedAt == null) throw new BadRequestException('Ngữ cảnh đánh giá không hợp lệ.');
  const annualPeriod = annualPeriodAt(options.submittedAt);
  const resolved: ApprovedPortalPolicy = { ...registered,
    requirements: registered.requirements.map(item => item.component ? { ...item, periods: [annualPeriod] } : item) };
  const evaluation = evaluatePolicy(resolved, data, documents, options.phase);
  const issues: { code: string; path: string; step: number; message: string }[] = [];
  const missingFields: string[] = [];
  function issue(path: string, code: string, message: string, missing = false) {
    const step = ['loanPurpose','loanType','proposedAmount','loanTermMonths','hasExistingDebt','collateral.mode','collateral.description'].includes(path) ? 2
      : path.startsWith('annualRevenueBasis') ? 4 : path.startsWith('submissionDeclaration') ? 5 : 1;
    issues.push({ path, code, step, message });
    if (missing && !missingFields.includes(path)) missingFields.push(path);
  }
  for (const field of registered.requiredFields) {
    const value = atPath(data, field);
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) issue(field, 'MISSING_DATA', `Cần cung cấp: ${fieldLabels[field] ?? field}.`, true);
  }
  if (atPath(data, 'businessScope') !== 'MANUFACTURING') issue('businessScope', 'OUTSIDE_SCOPE', 'Chính sách mô phỏng này chỉ áp dụng doanh nghiệp sản xuất.');
  if (atPath(data, 'loanType') !== 'VAY_VON_LUU_DONG') issue('loanType', 'OUTSIDE_SCOPE', 'Chính sách mô phỏng này chỉ áp dụng vay vốn lưu động.');
  if (atPath(data, 'revenuePeriod') !== annualPeriod) issue('revenuePeriod', 'ANNUAL_PERIOD', `Cần báo cáo năm ${annualPeriod}; không tự quy đổi số liệu tháng/quý.`);
  const establishedYear = atPath(data, 'establishedYear');
  if (typeof establishedYear === 'number' && establishedYear > Number(annualPeriod)) issue('revenuePeriod', 'ANNUAL_BEFORE_ESTABLISHMENT', 'Năm báo cáo không được trước năm thành lập; chưa có dữ liệu năm phù hợp thì tiếp tục lưu nháp.');
  if (atPath(data, 'annualRevenueBasis.fullYearCompleted') !== true) issue('annualRevenueBasis.fullYearCompleted', 'ANNUAL_INCOMPLETE', 'Cần xác nhận dữ liệu năm đã hoàn thành; chưa có thì tiếp tục lưu nháp.');
  const superseded = new Set(documents.map(document => document.supersedesId).filter(Boolean));
  const source = documents.find(document => document.id === atPath(data, 'annualRevenueBasis.documentId') && !document.withdrawnAt
    && !superseded.has(document.id) && document.documentGroup === 'B'
    && validateCoverage(document.documentGroup, document.coverage).some(entry => entry.documentTypeCode === 'B_FINANCIAL_STATEMENTS'
      && entry.period === annualPeriod && entry.components?.includes('INCOME_STATEMENT')));
  if (!source) issue('annualRevenueBasis.documentId', 'ANNUAL_SOURCE', 'Chọn BCTC nguồn đang sử dụng, thuộc đề nghị, đúng năm và có phần kết quả kinh doanh.');
  if (atPath(data, 'representative.mode') === 'AUTHORIZED' && !String(atPath(data, 'representative.name') ?? '').trim()) issue('representative.name', 'MISSING_DATA', 'Cần khai tên người thao tác theo ủy quyền.', true);
  const collateralMode = atPath(data, 'collateral.mode');
  if (!['PROPOSED','NONE_REQUESTED'].includes(String(collateralMode))) issue('collateral.mode', 'UNDECIDED', 'Cần khai rõ có hoặc không đề xuất bảo đảm; chưa xác định thì giữ nháp.');
  if (collateralMode === 'PROPOSED' && !String(atPath(data, 'collateral.description') ?? '').trim()) issue('collateral.description', 'MISSING_DATA', 'Cần mô tả tài sản bảo đảm dự kiến.', true);
  if (atPath(data, 'submissionDeclaration.accepted') !== true) issue('submissionDeclaration.accepted', 'DECLARATION_REQUIRED', 'Cần xác nhận cam kết trước khi gửi.');
  if (atPath(data, 'submissionDeclaration.version') !== registered.declaration.version) issue('submissionDeclaration.version', 'DECLARATION_VERSION', 'Cần xác nhận nội dung cam kết đang áp dụng.');
  const requirements = evaluation.requirements.map((item, index) => ({ ...item, ...resolved.requirements[index],
    state: !item.applies ? 'NOT_APPLICABLE' as const : !item.due ? 'LATER' as const : item.satisfied ? 'PROVIDED_PENDING_REVIEW' as const : 'MISSING' as const }));
  return { policyVersion: registered.version, annualPeriod, phase: options.phase, missingFields,
    missingDocuments: evaluation.missing, formErrors: evaluation.formErrors, issues, requirements,
    dataReady: missingFields.length === 0 && issues.length === 0 && evaluation.missing.length === 0 && evaluation.formErrors.length === 0,
    canSubmit: false as const, canAccept: false as const, businessValidity: 'NOT_REVIEWED' as const, creditDecision: null,
    note: 'Kiểm tra mức cung cấp theo khai báo; CBTD còn phải đối chiếu nội dung. Chưa mở nộp hoặc tiếp nhận theo chính sách này.' };
}
