import type { LoanApplication, RoleCode } from './types';

const PATH_PATTERN = /^\/tham-dinh\/([^/]+)\/?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRANCH_LIMIT = 10_000_000_000;
const LOOKUP_PARAM = 'xem';
const LOOKUP_VALUE = 'tra-cuu';

export const appraisalPath = (reference: string) => `/tham-dinh/${encodeURIComponent(reference)}`;
export const lookupAppraisalPath = (reference: string) => `${appraisalPath(reference)}?${LOOKUP_PARAM}=${LOOKUP_VALUE}`;
export const isLookupAddress = (search: string) => new URLSearchParams(search).get(LOOKUP_PARAM) === LOOKUP_VALUE;
export const isLoanUuid = (reference: string) => UUID_PATTERN.test(reference);

export function appraisalRefFromPath(pathname: string): string | null {
  const encoded = pathname.match(PATH_PATTERN)?.[1];
  if (!encoded) return null;
  try { return decodeURIComponent(encoded); } catch { return null; }
}

export interface ReportVersionView { id: string; sequence: number; content: Record<string, string>; submittedAt: string; submittedByName?: string | null }
export interface ReportEventView { kind: string; createdAt: string; payload?: { message?: string } | null }
export interface AppraisalReportView {
  id?: string;
  revision?: number;
  status: string;
  draft?: Record<string, string>;
  versions: ReportVersionView[];
  events?: ReportEventView[];
  clarification?: { message: string } | null;
  decidedVersionId?: string | null;
  evidenceChanged?: boolean;
  makerChecker?: { canClarify: boolean; clarifyBlockReason: string | null };
}

export const REPORT_SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ['legalAssessment', 'Pháp lý và người đại diện'],
  ['businessAssessment', 'Kinh doanh và phương án vốn'],
  ['financialAssessment', 'Tài chính và tài liệu làm căn cứ'],
  ['repaymentSource', 'Dòng tiền và nguồn trả nợ'],
  ['collateralAssessment', 'Tài sản bảo đảm'],
  ['risks', 'Rủi ro và biện pháp kiểm soát'],
];

export const REPORT_PROPOSAL_LABEL = 'Đề xuất của CBTD';
export const REPORT_CONDITIONS_LABEL = 'Điều kiện đề xuất';
export const REPORT_RATE_KEY = 'proposedInterestRate';
export const REPORT_RATE_LABEL = 'Lãi suất đề xuất (%/năm)';
export const RATE_ERROR = 'Lãi suất phải từ 0 đến 100%/năm, tối đa 2 chữ số thập phân.';
const RATE_TEXT = /^\d{1,3}(\.\d{1,2})?$/;

export const normalizeRateText = (text: string) => text.trim().replace(',', '.');

/** Lãi suất %/năm từ 0 đến 100, tối đa 2 chữ số thập phân; nhận cả dấu phẩy thập phân. */
export function parseRateText(text: string): number | null {
  const normalized = normalizeRateText(text);
  return RATE_TEXT.test(normalized) && Number(normalized) <= 100 ? Number(normalized) : null;
}

export const rateText = (value: number | string) => `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%/năm`;

export interface RateBandView { id: string; minRate: number; maxRate: number; effectiveFrom: string; basis: string }
export const NO_BAND_ERROR = 'Chưa có khung lãi suất hiệu lực cho loại vay này. Liên hệ Admin cấu hình khung.';
const percentText = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export const bandText = (band: Pick<RateBandView, 'minRate' | 'maxRate'>) => `${percentText(band.minRate)}–${percentText(band.maxRate)}%/năm`;
export const rateInBand = (rate: number, band: Pick<RateBandView, 'minRate' | 'maxRate'>) => rate >= band.minRate && rate <= band.maxRate;

export interface ApprovalRateCheck { rate: number | null; deviates: boolean; ready: boolean; error: string | null }

/** Thẩm quyền chọn trong khung đang hiệu lực; khác mức CBTD đề xuất thì phải ghi lý do. `band` để trống là không xét khung. */
export function approvalRateCheck({ rate, proposed, reason, band }: { rate: string; proposed: number | null; reason: string; band?: RateBandView | null }): ApprovalRateCheck {
  if (band === null) return { rate: null, deviates: false, ready: false, error: NO_BAND_ERROR };
  if (!rate.trim()) return { rate: null, deviates: false, ready: false, error: null };
  const value = parseRateText(rate);
  if (value === null) return { rate: null, deviates: false, ready: false, error: RATE_ERROR };
  if (band && !rateInBand(value, band)) return { rate: value, deviates: false, ready: false, error: `Lãi suất phải trong khung ${bandText(band)}.` };
  const deviates = proposed !== null && value !== proposed;
  return { rate: value, deviates, ready: !deviates || Boolean(reason.trim()), error: null };
}

/** Tờ trình chưa có lãi suất đề xuất thì Thẩm quyền không tự chọn lãi suất: phải yêu cầu CBTD làm rõ và trình lại. */
export function proposedRateBasis(report: AppraisalReportView | null): { rate: number | null; note: string | null; blocksApproval: boolean } {
  const latest = report?.versions[0];
  if (!latest) return { rate: null, note: 'Hồ sơ quy trình cũ, không có tờ trình.', blocksApproval: false };
  const rate = parseRateText(latest.content[REPORT_RATE_KEY] ?? '');
  return rate === null
    ? { rate: null, note: 'Tờ trình chưa có lãi suất đề xuất. Yêu cầu CBTD làm rõ và trình lại với lãi suất đề xuất trước khi phê duyệt.', blocksApproval: true }
    : { rate, note: null, blocksApproval: false };
}
const FORM_HINTS: Record<string, string> = { collateralAssessment: ' (ghi không áp dụng nếu có căn cứ)' };
export const REPORT_FORM_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ...REPORT_SECTIONS.map(([key, label]) => [key, `${label}${FORM_HINTS[key] ?? ''}`] as const),
  ['recommendation', REPORT_PROPOSAL_LABEL],
  [REPORT_RATE_KEY, REPORT_RATE_LABEL],
  ['proposedConditions', `${REPORT_CONDITIONS_LABEL} (nếu có)`],
];

const previousVersion = (versions: ReportVersionView[], version: ReportVersionView) =>
  versions.filter(item => item.sequence < version.sequence).sort((a, b) => b.sequence - a.sequence)[0];

export function changedReportSections(versions: ReportVersionView[], version: ReportVersionView): Set<string> {
  const previous = previousVersion(versions, version);
  if (!previous) return new Set();
  const keys = new Set([...Object.keys(version.content), ...Object.keys(previous.content)]);
  return new Set(Array.from(keys).filter(key => (version.content[key] ?? '').trim() !== (previous.content[key] ?? '').trim()));
}

export function clarificationAnswered(events: ReportEventView[] | undefined, versions: ReportVersionView[], version: ReportVersionView): string | null {
  const previous = previousVersion(versions, version);
  if (!previous || !events) return null;
  const from = new Date(previous.submittedAt).getTime();
  const to = new Date(version.submittedAt).getTime();
  const answered = events
    .filter(event => event.kind === 'CLARIFICATION_REQUESTED' && new Date(event.createdAt).getTime() > from && new Date(event.createdAt).getTime() <= to)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return answered?.payload?.message ?? null;
}

export function evidenceState(report: AppraisalReportView, version: ReportVersionView, finished: boolean): 'UNCHANGED' | 'CHANGED' | null {
  if (finished || report.status !== 'SUBMITTED' || report.versions[0]?.id !== version.id) return null;
  return report.evidenceChanged ? 'CHANGED' : 'UNCHANGED';
}

export function debtToEquityText(loan: { proposedAmount: number | string; company: { charterCapital: number | string } }): string {
  const capital = Number(loan.company.charterCapital);
  return capital > 0 ? `${(Number(loan.proposedAmount) / capital).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} lần` : '—';
}

export const isLoanFinished = (loan: { currentStage?: string; completedAt?: string | null }) => loan.currentStage === 'HOAN_TAT' || Boolean(loan.completedAt);

export const REJECTION_REASONS: Record<string, string> = {
  TC01: 'Hồ sơ pháp lý không hợp lệ',
  TC02: 'Năng lực tài chính không đảm bảo',
  TC03: 'Phương án kinh doanh không khả thi',
  TC04: 'Tài sản bảo đảm không đủ điều kiện',
  TC05: 'Quá hạn thời gian bổ sung chứng từ',
};

export interface AppraisalActions {
  canDecide: boolean;
  canApprove: boolean;
  canClarify: boolean;
  versionId: string | undefined;
  blockReason: string | null;
}

function decisionBlockReason(loan: LoanApplication, report: AppraisalReportView | null): string | null {
  if (loan.coordinationRestrictions?.writeBlocked) return 'Bạn đang chờ giải quyết xung đột lợi ích nên chưa thao tác được trên hồ sơ này.';
  if (loan.coordinationRestrictions?.decisionBlocked) return 'Chưa được chốt quyết định khi xung đột lợi ích còn chờ giải quyết.';
  if (loan.makerCheckerRestrictions?.decisionBlocked) return loan.makerCheckerRestrictions.decisionBlockReason || 'Bạn không đủ điều kiện độc lập để quyết định hồ sơ này.';
  if (loan.currentStatus === 'SUPPLEMENT_REQUIRED') return 'Hồ sơ đang chờ bổ sung chứng từ. Hoàn tất yêu cầu bổ sung trước khi quyết định.';
  if (!loan.businessPolicyVersion) return null;
  if (!report?.versions?.length) return 'Hồ sơ chưa có tờ trình đã trình nên chưa quyết định được.';
  if (report.status === 'CLARIFICATION_REQUIRED') return 'Đang chờ CBTD làm rõ và trình lại tờ trình.';
  if (report.status !== 'SUBMITTED') return 'Tờ trình chưa ở trạng thái chờ quyết định.';
  if (report.evidenceChanged) return 'Căn cứ đã thay đổi sau khi tờ trình được trình. Hãy yêu cầu CBTD làm rõ và trình lại; sau đó mới phê duyệt hoặc từ chối được.';
  return null;
}

export function appraisalActions(loan: LoanApplication, report: AppraisalReportView | null, role: RoleCode | null | undefined): AppraisalActions {
  const finished = Boolean(loan.completedAt) || loan.currentStage !== 'THAM_DINH' || ['APPROVED', 'REJECTED', 'CLOSED_TIMEOUT'].includes(loan.currentStatus);
  if (role !== 'THAM_QUYEN' || finished) return { canDecide: false, canApprove: false, canClarify: false, versionId: undefined, blockReason: null };
  const blockReason = decisionBlockReason(loan, report);
  const canDecide = blockReason === null;
  const amount = Number(loan.officialAmount || loan.proposedAmount);
  return {
    canDecide,
    canApprove: canDecide && amount <= BRANCH_LIMIT,
    canClarify: Boolean(loan.businessPolicyVersion) && report?.status === 'SUBMITTED' && !loan.coordinationRestrictions?.writeBlocked && report.makerChecker?.canClarify !== false,
    versionId: canDecide && loan.businessPolicyVersion ? report?.versions[0]?.id : undefined,
    blockReason,
  };
}

const REPORT_STATES: Record<string, string> = {
  DRAFT: 'Đang lập',
  SUBMITTED: 'Chờ quyết định',
  CLARIFICATION_REQUIRED: 'Chờ CBTD làm rõ',
  DECIDED: 'Đã có quyết định',
};
const OUTCOMES: Record<string, string> = { APPROVED: 'Đã phê duyệt', REJECTED: 'Bị từ chối', CLOSED_TIMEOUT: 'Đã đóng do quá hạn bổ sung' };
export function reportStateLabel(loan: Pick<LoanApplication, 'currentStatus' | 'businessPolicyVersion' | 'reportStatus'>): string {
  if (OUTCOMES[loan.currentStatus]) return OUTCOMES[loan.currentStatus];
  if (loan.currentStatus === 'SUPPLEMENT_REQUIRED') return 'Chờ bổ sung';
  if (!loan.businessPolicyVersion) return 'Quy trình cũ';
  return REPORT_STATES[loan.reportStatus ?? ''] ?? 'Chưa có tờ trình';
}

const DOCUMENT_TYPES: Record<string, string> = {
  PHAP_LY: 'Pháp lý',
  TAI_CHINH: 'Tài chính',
  HOAT_DONG_SX: 'Hoạt động sản xuất kinh doanh',
  PHUONG_AN: 'Phương án kinh doanh',
  TSBD: 'Tài sản bảo đảm',
  DU_NO: 'Dư nợ hiện tại',
  KHAC: 'Khác',
};
export const documentTypeLabel = (code: string) => DOCUMENT_TYPES[code] ?? code;

const LOAN_TYPES: Record<string, string> = { VAY_VON_LUU_DONG: 'Vốn lưu động', VAY_DAU_TU_TSCD: 'Đầu tư tài sản cố định', THAU_CHI: 'Thấu chi' };
export const loanTypeLabel = (code: string) => LOAN_TYPES[code] ?? code;

const RISK_LEVELS: Record<string, string> = { CAO: 'Cao', TRUNG_BINH: 'Trung bình', THAP: 'Thấp' };
export const riskLabel = (code: string) => RISK_LEVELS[code] ?? code;

export const moneyText = (value?: number | string | null) => value === undefined || value === null || value === '' ? '—' : `${Number(value).toLocaleString('vi-VN')} VNĐ`;
