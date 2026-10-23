export type GroupCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export interface PortalData {
  taxCode?: string; companyName?: string; industry?: string; establishedYear?: number;
  annualRevenue?: number; charterCapital?: number; representativeName?: string; phone?: string;
  address?: string; loanPurpose?: string; loanType?: string; proposedAmount?: number; loanTermMonths?: number;
  companyType?: string; establishedDate?: string; contactName?: string; contactPosition?: string;
  contactPhone?: string; contactEmail?: string; revenuePeriod?: string; neededAt?: string; preferredBranch?: string;
  hasExistingDebt?: boolean;
  annualRevenueBasis?: {documentId?:string;fullYearCompleted?:boolean};
  collateral?: { mode?: 'PROPOSED' | 'NONE_REQUESTED' | 'UNDECIDED'; description?: string };
  capitalPlan?: { businessActivity?: string; costs?: { name?: string; amount?: number; plannedAt?: string }[]; ownFunds?: number; otherFunds?: number; otherFundsSource?: string; useFrom?: string; useTo?: string; repaymentSource?: string; recoveryDate?: string };
}
export interface PortalDocument { id: string; documentGroup: GroupCode; fileName: string; fileSize: number; uploadedAt: string; coverage?: { documentTypeCode: string; period?: string }[] | null; version?: number; supersedesId?: string | null; withdrawnAt?: string | null; mimeType?: string; contentHash?: string; sha256?: string }
export interface IntakeUser { id: string; fullName: string; username: string }
export interface PortalRequest { id: string; reference: string; status: 'DRAFT' | 'SUBMITTED' | 'ASSIGNED' | 'ACCEPTED'; data: PortalData; documents: PortalDocument[]; submittedAt?: string; acceptedAt?: string; loanId?: string; assignedTo?: string | null; assignedBy?: string | null; assignedAt?: string | null; assignedOfficer?: IntakeUser | null; formVersion?: number; checklistVersion?: string; revision?: number; account?: PortalAccount; checklistSnapshot?: Record<string, unknown> | null }
export interface PortalAccount { id: string; email: string; contactName: string; phone: string }
export interface PortalFormConfig {
  readinessVersion?:'MVP1';
  mvpPolicy?: {version:string;status:string;canSubmit:boolean};
  submitPolicyVersion?: string | null;
  formVersion: number; checklistVersion: string; legacyChecklistVersion: string; previewEnabled: boolean;
  policyStatus: string; canSubmit: boolean; canAccept?: boolean; technicalLimits: { maxFileBytes: number; maxActiveFiles: number };
  groups: { code: GroupCode; name: string; policyStatus: string; documentTypes: { code: string; name: string; purpose: string; formats: string[]; requiredness: string; stage: string; applicability: string; periodRequirement: string; deferralStatus: string; substituteStatus: string; versionRule: string; sendRule: string; policyStatus: string }[] }[];
}
export interface PortalChecklist {
  submitPolicyVersion?: string; missing?: string[]; formErrors?: string[];
  requirements?: {id:string;group:string;documentTypeCode:string;periods?:string[];applies:boolean;required:boolean;stage:string;satisfied:boolean}[];
  formVersion: number; checklistVersion: string; policyStatus: string; cannotSubmit: boolean;
  groups: { code: GroupCode; name: string; required: boolean | null; status: string; documents: { id: string; coverage: PortalDocument['coverage'] }[] }[];
}
export const requestStatus = { DRAFT: 'Bản nháp', SUBMITTED: 'Chờ phân công', ASSIGNED: 'Đã phân công — chờ tiếp nhận', ACCEPTED: 'Đã tiếp nhận' };
export const groups: { code: GroupCode; name: string; description: string; accept: string }[] = [
  { code: 'A', name: 'Pháp lý', description: 'Giấy đăng ký doanh nghiệp, điều lệ, giấy tờ người đại diện; giấy ủy quyền hoặc nghị quyết nếu cần.', accept: '.pdf' },
  { code: 'B', name: 'Tài chính', description: 'Báo cáo tài chính 2–3 năm và kỳ gần nhất, công nợ phải thu/phải trả, tồn kho.', accept: '.pdf,.xlsx' },
  { code: 'C', name: 'Hoạt động sản xuất', description: 'Hợp đồng đầu ra, đơn đặt hàng, tài liệu nguyên liệu, báo giá, kế hoạch sản xuất.', accept: '.pdf' },
  { code: 'D', name: 'Phương án vay', description: 'Phương án sử dụng vốn, kế hoạch trả nợ. Thông tin đề nghị vay được khai tại biểu mẫu bên trên.', accept: '.pdf' },
  { code: 'E', name: 'Tài sản bảo đảm', description: 'Giấy tờ sở hữu, hồ sơ pháp lý, hình ảnh tài sản bảo đảm và tài liệu định giá sẵn có.', accept: '.pdf,.jpg,.jpeg,.png' },
  { code: 'F', name: 'Dư nợ hiện tại', description: 'Thông tin khoản vay tại ngân hàng khác, lịch trả nợ và sao kê.', accept: '.pdf,.xlsx' },
];
export const fields: { key: keyof PortalData; label: string; type?: string; min?: number; max?: number }[] = [
  { key: 'taxCode', label: 'Mã số thuế' }, { key: 'companyName', label: 'Tên doanh nghiệp' },
  { key: 'industry', label: 'Ngành nghề' }, { key: 'establishedYear', label: 'Năm thành lập', type: 'number', min: 1950, max: new Date().getFullYear() },
  { key: 'annualRevenue', label: 'Doanh thu năm (VNĐ)', type: 'number', min: 0 }, { key: 'charterCapital', label: 'Vốn điều lệ (VNĐ)', type: 'number', min: 0 },
  { key: 'representativeName', label: 'Người đại diện' }, { key: 'phone', label: 'Số điện thoại', type: 'tel' },
  { key: 'address', label: 'Địa chỉ' }, { key: 'loanPurpose', label: 'Mục đích vay' },
  { key: 'loanType', label: 'Loại vay' }, { key: 'proposedAmount', label: 'Số tiền đề nghị vay (VNĐ)', type: 'number', min: 10000000 },
  { key: 'loanTermMonths', label: 'Thời hạn vay (tháng)', type: 'number', min: 1, max: 120 },
];
export const loanTypes: Record<string, string> = { VAY_VON_LUU_DONG: 'Vay vốn lưu động', VAY_DAU_TU_TSCD: 'Vay đầu tư tài sản cố định', THAU_CHI: 'Thấu chi' };
export function draftPayload(data: PortalData): PortalData {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && (typeof value !== 'string' || value.trim() !== '')).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
}
export function validateRequest(data: PortalData, full: boolean, documents: PortalDocument[] = []) {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = data[field.key];
    if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      if (full) errors[field.key] = `Vui lòng nhập ${field.label.toLowerCase()}.`;
      continue;
    }
    if (field.type === 'number' && (!Number.isFinite(value) || Number(value) < (field.min ?? 0) || Number(value) > (field.max ?? Number.MAX_SAFE_INTEGER))) errors[field.key] = `${field.label} không hợp lệ${field.max ? ` (tối đa ${field.max})` : ''}.`;
    if (['establishedYear', 'loanTermMonths'].includes(field.key) && !Number.isInteger(value)) errors[field.key] = 'Vui lòng nhập số nguyên.';
  }
  if (data.taxCode && !/^(\d{10}|\d{13})$/.test(data.taxCode)) errors.taxCode = 'Mã số thuế phải gồm 10 hoặc 13 chữ số.';
  if (data.phone && !/^[+\d][\d\s().-]{7,19}$/.test(data.phone)) errors.phone = 'Số điện thoại không hợp lệ.';
  if (data.loanType && !loanTypes[data.loanType]) errors.loanType = 'Vui lòng chọn loại vay hợp lệ.';
  if (full) for (const group of groups) if (!documents.some(doc => doc.documentGroup === group.code)) errors[group.code] = 'Vui lòng tải lên ít nhất một tài liệu cho nhóm này.';
  return errors;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
