import { dateTimeText } from './slaDisplay';
import type { LoanApplication, RoleCode } from './types';

export type QueueGroup = 'DECIDE' | 'CBTD' | 'ENTERPRISE' | 'OTHER_REVIEWER';
export type QueueReason = 'SUBMITTED' | 'LEGACY' | 'CLARIFICATION' | 'EVIDENCE_CHANGED' | 'NO_REPORT' | 'CONFLICT' | 'SUPPLEMENT' | 'NOT_INDEPENDENT';
export type QueueCounts = Record<QueueGroup, number>;

const ALWAYS_SHOWN: ReadonlyArray<readonly [QueueGroup, string]> = [['DECIDE', 'Chờ quyết định'], ['CBTD', 'Chờ CBTD'], ['ENTERPRISE', 'Chờ doanh nghiệp']];
const OTHER_REVIEWER_LABEL = 'Thẩm quyền khác xử lý';

export const DEFAULT_QUEUE_TAB: QueueGroup = 'DECIDE';

export function visibleQueueTabs(counts: QueueCounts | null) {
  const tabs = ALWAYS_SHOWN.map(([group, label]) => ({ group, label, count: counts?.[group] ?? 0 }));
  return counts?.OTHER_REVIEWER ? [...tabs, { group: 'OTHER_REVIEWER' as QueueGroup, label: OTHER_REVIEWER_LABEL, count: counts.OTHER_REVIEWER }] : tabs;
}

export function resolveQueueTab(active: QueueGroup, counts: QueueCounts | null): QueueGroup {
  return active === 'OTHER_REVIEWER' && counts && !counts.OTHER_REVIEWER ? DEFAULT_QUEUE_TAB : active;
}

const REASON_LABELS: Record<QueueReason, string> = {
  SUBMITTED: 'Chờ quyết định',
  LEGACY: 'Quy trình cũ, không có tờ trình',
  CLARIFICATION: 'CBTD đang làm rõ',
  EVIDENCE_CHANGED: 'Căn cứ đã đổi, cần trình lại',
  NO_REPORT: 'Chưa có tờ trình đã trình',
  CONFLICT: 'Chờ Quản lý giải quyết xung đột lợi ích',
  SUPPLEMENT: 'Chờ bổ sung chứng từ',
  NOT_INDEPENDENT: 'Bạn đã tham gia hồ sơ này',
};
export const queueReasonLabel = (reason?: QueueReason | null) => (reason ? REASON_LABELS[reason] ?? '' : '');

export const QUEUE_EMPTY: Record<QueueGroup, { title: string; detail: string }> = {
  DECIDE: { title: 'Hiện không có hồ sơ chờ quyết định', detail: 'Hồ sơ sẽ xuất hiện tại đây khi CBTD trình tờ trình.' },
  CBTD: { title: 'Không có hồ sơ chờ CBTD', detail: 'Hồ sơ cần làm rõ hoặc trình lại sẽ nằm tại đây.' },
  ENTERPRISE: { title: 'Không có hồ sơ chờ doanh nghiệp', detail: 'Hồ sơ đang chờ bổ sung chứng từ sẽ nằm tại đây.' },
  OTHER_REVIEWER: { title: 'Không có hồ sơ cần Thẩm quyền khác xử lý', detail: 'Hồ sơ bạn đã tham gia sẽ nằm tại đây.' },
};

export function queueReportLines(loan: Pick<LoanApplication, 'reportVersion' | 'queueReason'>) {
  const version = loan.reportVersion;
  return {
    title: version ? `Phiên bản ${version.sequence}` : 'Không có tờ trình',
    time: version ? dateTimeText(version.submittedAt) : '',
    note: queueReasonLabel(loan.queueReason),
  };
}

export const queueActionLabel = (role: RoleCode | null | undefined, group: QueueGroup) => (role === 'THAM_QUYEN' && group === 'DECIDE' ? 'Xem xét' : 'Xem');

export function lookupDecision(loan: Pick<LoanApplication, 'currentStage' | 'completedAt' | 'stageHistories'>) {
  if (loan.currentStage !== 'HOAN_TAT' && !loan.completedAt) return { by: '—', time: '' };
  const closing = loan.stageHistories?.find(history => history.stage?.stageCode === 'HOAN_TAT');
  return {
    by: closing?.handler?.fullName || closing?.handler?.username || 'Chưa ghi nhận',
    time: loan.completedAt ? dateTimeText(loan.completedAt) : '',
  };
}
