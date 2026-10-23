import { BadRequestException, ConflictException } from '@nestjs/common';
import { groups, validatePortalData } from './portal.validation';

export const LEGACY_CHECKLIST_VERSION = 'legacy-v1';
export const PREVIEW_CHECKLIST_VERSION = 'sme-preview-v2';
export type DocumentCoverage = { documentTypeCode: string; period?: string };

const legacyFields = ['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address','loanPurpose','loanType','proposedAmount','loanTermMonths'];
const textFields = ['companyType','contactName','contactPosition','contactPhone','contactEmail','preferredBranch'];
const dateFields = ['establishedDate','neededAt'];
const capitalText = ['businessActivity','otherFundsSource','repaymentSource'];
const capitalDates = ['useFrom','useTo','recoveryDate'];

function previewEnabled(): boolean {
  return process.env.PORTAL_FOUNDATION_PREVIEW === 'true' && ['development','test'].includes(process.env.NODE_ENV || '');
}

export function assertPreviewEnabled(): void {
  if (!previewEnabled()) {
    throw new ConflictException('Bản nháp v2 chỉ mở trong development/test khi bật preview.');
  }
}

function invalid(field: string): never {
  throw new BadRequestException(`Giá trị không hợp lệ: ${field}`);
}

function objectFields(input: unknown, allowed: string[], field: string): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) invalid(field);
  const value = input as Record<string, any>;
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid(field);
  return value;
}

function text(value: unknown, field: string): void {
  if (typeof value !== 'string' || !value.trim() || value.length > 4000) invalid(field);
}

function date(value: unknown, field: string): void {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000')) invalid(field);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) invalid(field);
}

function amount(value: unknown, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1e16) invalid(field);
}

/** Validate draft shape only. No v2 requiredness or lending policy is activated here. */
export function validateDraftV2(input: unknown): Record<string, any> {
  const data = objectFields(input, [...legacyFields,...textFields,...dateFields,'revenuePeriod','annualRevenueBasis','hasExistingDebt','collateral','capitalPlan'], 'draft');
  validatePortalData(Object.fromEntries(Object.entries(data).filter(([key]) => legacyFields.includes(key))));
  for (const field of textFields) if (data[field] !== undefined) text(data[field], field);
  for (const field of dateFields) if (data[field] !== undefined) date(data[field], field);
  for (const field of ['phone','contactPhone']) if (data[field] !== undefined && !/^[+\d][\d\s().-]{7,19}$/.test(data[field])) invalid(field);
  if (data.establishedDate !== undefined && data.establishedYear !== undefined && Number(data.establishedDate.slice(0,4)) !== data.establishedYear) invalid('establishedYear');
  if (data.revenuePeriod !== undefined && (typeof data.revenuePeriod !== 'string' || !/^(?!0000)[0-9]{4}(?:-(?:0[1-9]|1[0-2]|Q[1-4]))?$/.test(data.revenuePeriod))) invalid('revenuePeriod');
  if (data.contactEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) invalid('contactEmail');
  if (data.hasExistingDebt !== undefined && typeof data.hasExistingDebt !== 'boolean') invalid('hasExistingDebt');
  if(data.annualRevenueBasis!==undefined){const basis=objectFields(data.annualRevenueBasis,['documentId','fullYearCompleted'],'annualRevenueBasis');if(basis.documentId!==undefined)text(basis.documentId,'annualRevenueBasis.documentId');if(basis.fullYearCompleted!==undefined&&typeof basis.fullYearCompleted!=='boolean')invalid('annualRevenueBasis.fullYearCompleted');}
  if (data.collateral !== undefined) {
    const collateral = objectFields(data.collateral, ['mode','description'], 'collateral');
    if (collateral.mode !== undefined && !['PROPOSED','NONE_REQUESTED','UNDECIDED'].includes(collateral.mode)) invalid('collateral.mode');
    if (collateral.description !== undefined) text(collateral.description, 'collateral.description');
  }
  if (data.capitalPlan !== undefined) {
    const plan = objectFields(data.capitalPlan, [...capitalText,...capitalDates,'costs','ownFunds','otherFunds'], 'capitalPlan');
    for (const field of capitalText) if (plan[field] !== undefined) text(plan[field], `capitalPlan.${field}`);
    for (const field of capitalDates) if (plan[field] !== undefined) date(plan[field], `capitalPlan.${field}`);
    if (plan.useFrom !== undefined && plan.useTo !== undefined && plan.useFrom > plan.useTo) invalid('capitalPlan.useTo');
    for (const field of ['ownFunds','otherFunds']) if (plan[field] !== undefined) amount(plan[field], `capitalPlan.${field}`);
    if (plan.costs !== undefined) {
      if (!Array.isArray(plan.costs) || plan.costs.length > 100) invalid('capitalPlan.costs');
      for (const item of plan.costs) {
        const cost = objectFields(item, ['name','amount','plannedAt'], 'capitalPlan.costs');
        if (cost.name !== undefined) text(cost.name, 'cost.name');
        if (cost.amount !== undefined) amount(cost.amount, 'cost.amount');
        if (cost.plannedAt !== undefined) date(cost.plannedAt, 'cost.plannedAt');
      }
    }
  }
  return data;
}

const catalog = [
  {code:'A',name:'Pháp lý doanh nghiệp',types:[['A_BUSINESS_REGISTRATION','Đăng ký doanh nghiệp'],['A_CHARTER','Điều lệ'],['A_REPRESENTATIVE_AUTHORITY','Thẩm quyền đại diện/ký'],['A_REPRESENTATIVE_ID','Giấy tờ định danh người đại diện'],['A_AUTHORIZATION','Văn bản ủy quyền']]},
  {code:'B',name:'Tài chính',types:[['B_FINANCIAL_STATEMENTS','Báo cáo tài chính'],['B_LATEST_FINANCIAL_STATEMENTS','Báo cáo tài chính kỳ gần nhất'],['B_RECEIVABLES_PAYABLES','Chi tiết công nợ phải thu/phải trả'],['B_INVENTORY','Chi tiết hàng tồn kho']]},
  {code:'C',name:'Hoạt động sản xuất kinh doanh',types:[['C_BUSINESS_CONTRACT','Hợp đồng kinh doanh'],['C_INVOICE','Hóa đơn'],['C_PURCHASE_ORDER','Đơn đặt hàng'],['C_MATERIAL_CONTRACT','Hợp đồng nguyên vật liệu'],['C_QUOTATION','Báo giá'],['C_PRODUCTION_PLAN','Kế hoạch sản xuất kinh doanh']]},
  {code:'D',name:'Phương án sử dụng vốn',types:[['D_CAPITAL_PLAN','Phương án sử dụng vốn'],['D_LOAN_REQUEST','Đề nghị vay vốn'],['D_REPAYMENT_CASHFLOW','Dòng tiền trả nợ']]},
  {code:'E',name:'Tài sản bảo đảm',types:[['E_COLLATERAL_TITLE','Hồ sơ quyền đối với tài sản'],['E_COLLATERAL_VALUATION','Thông tin định giá tài sản']]},
  {code:'F',name:'Dư nợ hiện có',types:[['F_DEBT_STATEMENT','Thông tin dư nợ'],['F_REPAYMENT_SCHEDULE','Lịch trả nợ'],['F_BANK_STATEMENT','Sao kê ngân hàng']]},
];

function formats(group: string): string[] {
  return group === 'B' || group === 'F' ? ['pdf','xlsx'] : group === 'E' ? ['pdf','jpg','jpeg','png'] : ['pdf'];
}

export function validateCoverage(group: string, input: unknown): DocumentCoverage[] {
  if (!groups.includes(group) || !Array.isArray(input) || input.length < 1 || input.length > 30) invalid('coverage');
  const codes = catalog.find(item => item.code === group)!.types.map(item => item[0]);
  const seen = new Set<string>();
  const result: DocumentCoverage[] = input.map(item => {
    const entry = objectFields(item, ['documentTypeCode','period'], 'coverage');
    if (typeof entry.documentTypeCode !== 'string' || !codes.includes(entry.documentTypeCode)) invalid('documentTypeCode');
    if (entry.period !== undefined && (typeof entry.period !== 'string' || !/^(?!0000)[0-9]{4}(?:-(?:0[1-9]|1[0-2]|Q[1-4]))?$/.test(entry.period))) invalid('period');
    const key = `${entry.documentTypeCode}:${entry.period || ''}`;
    if (seen.has(key)) invalid('coverage duplicate');
    seen.add(key);
    return entry.period === undefined ? {documentTypeCode:entry.documentTypeCode} : {documentTypeCode:entry.documentTypeCode,period:entry.period};
  });
  return result.sort((a,b) => a.documentTypeCode.localeCompare(b.documentTypeCode) || (a.period || '').localeCompare(b.period || ''));
}

export function getFormConfig() {
  return {
    formVersion: 2,
    previewEnabled: previewEnabled(),
    technicalLimits: {maxFileBytes: 10485760, maxActiveFiles: 60},
    checklistVersion: PREVIEW_CHECKLIST_VERSION,
    legacyChecklistVersion: LEGACY_CHECKLIST_VERSION,
    policyStatus: 'PENDING_POLICY',
    canSubmit: false,
    groups: catalog.map(group => ({
      code: group.code,
      name: group.name,
      policyStatus: 'PENDING_POLICY',
      documentTypes: group.types.map(([code,name]) => ({
        code, name, purpose: group.name, formats: formats(group.code),
        group: group.code, description: name, ruleVersion: 'PENDING_POLICY', alternatives: [],
        nonApplicabilityBasis: 'PENDING_POLICY', deferralBasis: 'PENDING_POLICY',
        policyStatus: 'PENDING_POLICY', requiredness: 'PENDING_POLICY',
        stage: 'PENDING_POLICY', applicability: 'PENDING_POLICY', versionRule: 'APPEND_ONLY', sendRule: 'PENDING_POLICY',
        periodRequirement: 'PENDING_POLICY', deferralStatus: 'NOT_APPROVED', substituteStatus: 'NOT_APPROVED',
      })),
    })),
  };
}

type ChecklistDocument = { id: string; documentGroup: string; coverage?: unknown; supersedesId?: string | null; withdrawnAt?: unknown };
type ChecklistRequest = { formVersion?: number; checklistVersion?: string; documents?: ChecklistDocument[] };

export function checklistFor(request: ChecklistRequest) {
  const formVersion = request.formVersion ?? 1;
  const expectedVersion = formVersion === 1 ? LEGACY_CHECKLIST_VERSION : PREVIEW_CHECKLIST_VERSION;
  const checklistVersion = request.checklistVersion ?? expectedVersion;
  const unsupported = ![1,2].includes(formVersion) || checklistVersion !== expectedVersion;
  const preview = formVersion !== 1 || unsupported;
  const policyStatus = unsupported ? 'UNSUPPORTED_VERSION' : preview ? 'PENDING_POLICY' : 'LEGACY_GROUP_RULES';
  const documents = request.documents || [];
  const superseded = new Set(documents.map(document => document.supersedesId).filter(Boolean));
  const current = documents.filter(document => !document.withdrawnAt && !superseded.has(document.id));
  return {
    formVersion,
    checklistVersion,
    policyStatus,
    cannotSubmit: preview,
    groups: catalog.map(group => {
      const files = current.filter(document => document.documentGroup === group.code);
      return {
        code: group.code, name: group.name,
        required: preview ? null : true,
        status: preview ? policyStatus : files.length ? 'UPLOADED' : 'MISSING',
        // Upload is evidence of receipt only; it never denotes business approval.
        documents: files.map(document => ({id:document.id,coverage:document.coverage ?? null})),
      };
    }),
  };
}
