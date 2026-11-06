import type { LoanApplication } from './types';

const PATH_PATTERN = /^\/ho-so\/([^/]+)\/?$/;
const FINISHED_STATUSES = ['APPROVED', 'REJECTED', 'CLOSED_TIMEOUT'];

export const officerCasePath = (reference: string) => `/ho-so/${encodeURIComponent(reference)}`;

export function officerCaseRefFromPath(pathname: string): string | null {
  const encoded = pathname.match(PATH_PATTERN)?.[1];
  if (!encoded) return null;
  try { return decodeURIComponent(encoded); } catch { return null; }
}

export const LEAVE_WARNING = 'Bạn có nội dung chưa lưu trên hồ sơ này. Rời trang sẽ mất nội dung đó. Vẫn rời trang?';

export function draftChanged(current: Record<string, string>, saved: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(saved)]);
  return Array.from(keys).some(key => (current[key] ?? '') !== (saved[key] ?? ''));
}

type CaseFields = Pick<LoanApplication, 'assignedTo' | 'currentStage' | 'currentStatus' | 'completedAt' | 'coordinationRestrictions' | 'businessPolicyVersion' | 'isDocumentComplete' | 'officialAmount'>;
interface ReportFields { status: string; clarification?: { message: string } | null }

export interface OfficerAccess {
  finished: boolean;
  writeBlocked: boolean;
  waitingSupplement: boolean;
  owner: boolean;
  reception: boolean;
  canEditReport: boolean;
}

export function officerAccess(loan: CaseFields, report: ReportFields | null, userId: string | undefined): OfficerAccess {
  const finished = loan.currentStage === 'HOAN_TAT' || Boolean(loan.completedAt) || FINISHED_STATUSES.includes(loan.currentStatus);
  const writeBlocked = Boolean(loan.coordinationRestrictions?.writeBlocked);
  const owner = !loan.assignedTo || loan.assignedTo === userId;
  const open = !finished && !writeBlocked;
  const reportOpen = report?.status === 'CLARIFICATION_REQUIRED' || (loan.currentStage === 'TIEP_NHAN' && (!report || report.status === 'DRAFT'));
  return {
    finished,
    writeBlocked,
    waitingSupplement: loan.currentStatus === 'SUPPLEMENT_REQUIRED',
    owner,
    reception: open && owner && loan.currentStage === 'TIEP_NHAN',
    canEditReport: open && loan.assignedTo === userId && Boolean(loan.businessPolicyVersion) && reportOpen,
  };
}

export type OfficerSituationKind = 'finished' | 'blocked' | 'notOwner' | 'waitingSupplement' | 'clarification' | 'submitted' | 'steps';
export interface OfficerSituation { kind: OfficerSituationKind; title: string; detail: string }

export function officerSituation(loan: CaseFields, report: ReportFields | null, access: OfficerAccess): OfficerSituation {
  if (access.finished) return { kind: 'finished', title: 'Hồ sơ đã kết thúc', detail: 'Không còn việc cần làm trên hồ sơ này.' };
  if (access.writeBlocked) return { kind: 'blocked', title: 'Đang chờ giải quyết xung đột lợi ích', detail: 'Các thao tác ghi trên hồ sơ này bị chặn đến khi Quản lý xử lý đề nghị của bạn.' };
  if (!access.owner) return { kind: 'notOwner', title: 'Chỉ xem', detail: 'Hồ sơ này đang do cán bộ khác phụ trách.' };
  if (access.waitingSupplement) return { kind: 'waitingSupplement', title: 'Đang chờ doanh nghiệp bổ sung', detail: 'SLA tạm dừng. Hồ sơ chưa thể xác nhận đủ, sửa hạn mức hoặc trình tờ trình cho đến khi hoàn tất yêu cầu bổ sung.' };
  if (report?.status === 'CLARIFICATION_REQUIRED') return { kind: 'clarification', title: 'Thẩm quyền yêu cầu làm rõ', detail: report.clarification?.message ?? 'Làm rõ nội dung và trình lại tờ trình.' };
  if (loan.currentStage !== 'TIEP_NHAN') return { kind: 'submitted', title: 'Đang chờ Thẩm quyền quyết định', detail: 'Hiện không có việc cần làm. Hồ sơ chỉ xem ở công đoạn này.' };
  return { kind: 'steps', title: 'Việc cần làm', detail: '' };
}

export type OfficerStepKey = 'documents' | 'amount' | 'report' | 'transition';
export interface OfficerStep { key: OfficerStepKey; done: boolean }

export function officerSteps(loan: CaseFields, amountValid: boolean): OfficerStep[] {
  return [
    { key: 'documents', done: loan.isDocumentComplete && loan.currentStatus === 'CHECKED' },
    { key: 'amount', done: Boolean(loan.officialAmount) && amountValid },
    { key: loan.businessPolicyVersion ? 'report' : 'transition', done: false },
  ];
}

export function submitBlockReason({ loan, report, content, dirty, required }: {
  loan: CaseFields;
  report: ReportFields | null;
  content: Record<string, string>;
  dirty: boolean;
  required: ReadonlyArray<readonly [string, string]>;
}): string | null {
  if (loan.currentStatus === 'SUPPLEMENT_REQUIRED') return 'Cần hoàn tất yêu cầu bổ sung trước khi trình.';
  if (loan.currentStage === 'TIEP_NHAN' && !(loan.isDocumentComplete && loan.currentStatus === 'CHECKED')) return 'Cần xác nhận đủ hồ sơ trước khi trình.';
  if (!loan.officialAmount) return 'Cần xác định hạn mức chính thức trước khi trình.';
  const missing = required.filter(([key]) => !content[key]?.trim()).map(([, label]) => label);
  if (missing.length) return `Còn thiếu nội dung: ${missing.join(', ')}.`;
  if (dirty || !report) return 'Cần lưu nháp trước khi trình.';
  return null;
}
