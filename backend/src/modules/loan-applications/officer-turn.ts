import { LoanStatus, StageCode } from '@prisma/client';
import { classifyQueueRow, type QueueFacts } from './appraisal-queue';

export type OfficerTurnFacts = Omit<QueueFacts, 'appraisalReport'> & {
  currentStage: string;
  appraisalReport: { status: string; versions: { evidenceHash: string }[] } | null;
};

/** Các trường cần đọc để xếp lượt xử lý và kiểm tra căn cứ tờ trình của một hồ sơ. */
export const OFFICER_TURN_SELECT = {
  id: true, currentStage: true, currentStatus: true, completedAt: true, assignedTo: true, intakeOfficerId: true, businessPolicyVersion: true,
  companyId: true, companySnapshot: true, proposedAmount: true, officialAmount: true, loanPurpose: true, loanType: true, loanTermMonths: true,
  supplementRequests: { where: { status: 'PENDING' }, select: { id: true } },
  coordinationRequests: { where: { status: 'PENDING', reasonCode: 'CONFLICT_OF_INTEREST' }, select: { id: true } },
  appraisalReport: { select: { status: true, versions: { orderBy: { sequence: 'desc' }, take: 1, select: { evidenceHash: true } } } },
} as const;

const OFFICER = { id: '', activeRole: 'CBTD' };

function placeInQueue(loan: OfficerTurnFacts, evidenceChanged: boolean) {
  return classifyQueueRow({ ...loan, appraisalReport: loan.appraisalReport && { ...loan.appraisalReport, events: [] } }, evidenceChanged, OFFICER);
}

/** Tờ trình đã trình và đang chờ Thẩm quyền; chỉ những hồ sơ này cần kiểm tra căn cứ có đổi sau khi trình hay không. */
export function needsEvidenceCheck(loan: OfficerTurnFacts): boolean {
  return loan.currentStage === StageCode.THAM_DINH && placeInQueue(loan, false).reason === 'SUBMITTED';
}

/**
 * Hồ sơ đang chờ chính CBTD phụ trách xử lý. Tiếp nhận: khi không chờ doanh nghiệp bổ sung.
 * Thẩm định: khi hàng việc thẩm định xếp hồ sơ vào nhóm chờ CBTD (làm rõ, lập lại tờ trình, căn cứ đã đổi, xung đột).
 */
export function isOfficerTurn(loan: OfficerTurnFacts, evidenceChanged: boolean): boolean {
  if (loan.currentStage === StageCode.TIEP_NHAN) return loan.currentStatus === LoanStatus.RECEIVED || loan.currentStatus === LoanStatus.CHECKED;
  if (loan.currentStage !== StageCode.THAM_DINH) return false;
  return placeInQueue(loan, evidenceChanged).group === 'CBTD';
}

export type OfficerTask = 'INTAKE_CHECK' | 'INTAKE_FORWARD' | 'NO_REPORT' | 'CLARIFICATION' | 'EVIDENCE_CHANGED' | 'CONFLICT';

/** Việc CBTD phụ trách cần làm tiếp theo trên hồ sơ, cùng điều kiện với `isOfficerTurn`; không đến lượt CBTD thì null. */
export function officerTask(loan: OfficerTurnFacts, evidenceChanged: boolean): OfficerTask | null {
  if (!isOfficerTurn(loan, evidenceChanged)) return null;
  if (loan.currentStage === StageCode.TIEP_NHAN) return loan.currentStatus === LoanStatus.RECEIVED ? 'INTAKE_CHECK' : 'INTAKE_FORWARD';
  const reason = placeInQueue(loan, evidenceChanged).reason;
  return reason === 'CLARIFICATION' || reason === 'EVIDENCE_CHANGED' || reason === 'CONFLICT' ? reason : 'NO_REPORT';
}

/** Hồ sơ Thẩm định đang chờ Thẩm quyền ra quyết định: tờ trình đã trình còn nguyên căn cứ, hoặc hồ sơ quy trình cũ không có tờ trình. */
export function isAwaitingDecision(loan: OfficerTurnFacts, evidenceChanged: boolean): boolean {
  return loan.currentStage === StageCode.THAM_DINH && placeInQueue(loan, evidenceChanged).group === 'DECIDE';
}
