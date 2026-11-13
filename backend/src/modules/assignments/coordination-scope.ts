import { isEvidenceChanged } from '../appraisal/appraisal.logic';
import { isAwaitingDecision, needsEvidenceCheck, OFFICER_TURN_SELECT } from '../loan-applications/officer-turn';
import { COORDINATION_REASONS } from './assignment-coordination';

export const AWAITING_DECISION_MESSAGE = 'Hồ sơ đang chờ Thẩm quyền quyết định nên chỉ được báo xung đột lợi ích.';

/**
 * Lý do điều phối được dùng cho một hồ sơ vay. Khi hồ sơ đang chờ Thẩm quyền quyết định, CBTD không còn việc để bàn giao
 * nên chỉ còn báo xung đột lợi ích; các trường hợp khác dùng đủ lý do.
 */
export async function allowedCoordinationReasons(db: any, applicationId: string): Promise<{ reasonCodes: string[]; restriction: string | null }> {
  const all = { reasonCodes: [...COORDINATION_REASONS], restriction: null };
  const loan = await db.loanApplication.findUnique({ where: { id: applicationId }, select: OFFICER_TURN_SELECT });
  if (!loan) return all;
  const changed = needsEvidenceCheck(loan) && await isEvidenceChanged(db, loan, loan.appraisalReport.versions[0].evidenceHash);
  return isAwaitingDecision(loan, changed) ? { reasonCodes: ['CONFLICT_OF_INTEREST'], restriction: AWAITING_DECISION_MESSAGE } : all;
}
