import { moneyText, reportStateLabel, REJECTION_REASONS } from './appraisalWorkspace';
import { dateTimeText, slaDeadlineCell } from './slaDisplay';
import type { LoanApplication } from './types';

export const LOAN_PAGE_SIZE = 20;

export type StatusTone = 'blue' | 'teal' | 'amber' | 'purple' | 'green' | 'red' | 'gray';

const STATUS_VIEWS: Record<string, { label: string; tone: StatusTone }> = {
  RECEIVED: { label: 'Mới tiếp nhận', tone: 'blue' },
  CHECKED: { label: 'Đã đủ hồ sơ', tone: 'teal' },
  SUPPLEMENT_REQUIRED: { label: 'Chờ bổ sung', tone: 'amber' },
  PENDING_APPRAISAL: { label: 'Đang thẩm định', tone: 'purple' },
  APPROVED: { label: 'Đã phê duyệt', tone: 'green' },
  REJECTED: { label: 'Bị từ chối', tone: 'red' },
  CLOSED_TIMEOUT: { label: 'Đã đóng do quá hạn', tone: 'gray' },
};
export const loanStatusView = (status: string) => STATUS_VIEWS[status] ?? { label: 'Không xác định', tone: 'gray' as StatusTone };

const STAGES: Record<string, { label: string; progress: number }> = {
  TIEP_NHAN: { label: 'Tiếp nhận', progress: 1 },
  THAM_DINH: { label: 'Thẩm định', progress: 2 },
  HOAN_TAT: { label: 'Hoàn tất', progress: 3 },
};
export const stageLabel = (stage: string) => STAGES[stage]?.label ?? stage;
export const stageProgress = (stage: string) => STAGES[stage]?.progress ?? 0;

export interface StatusDetail { text: string; tone: 'normal' | 'danger' | 'muted' }

export function loanStatusDetail(loan: Pick<LoanApplication, 'currentStatus' | 'slaSummary' | 'approvedAmount' | 'interestRate' | 'rejectionReasonCode'>): StatusDetail {
  if (loan.currentStatus === 'APPROVED') {
    const rate = loan.interestRate === undefined || loan.interestRate === null ? '' : `, ${Number(loan.interestRate).toLocaleString('vi-VN')}%/năm`;
    return { text: `Duyệt ${moneyText(loan.approvedAmount)}${rate}`, tone: 'muted' };
  }
  if (loan.currentStatus === 'REJECTED' || loan.currentStatus === 'CLOSED_TIMEOUT') {
    const code = loan.rejectionReasonCode ?? '';
    return { text: REJECTION_REASONS[code] ? `${code} - ${REJECTION_REASONS[code]}` : code || 'Chưa ghi nhận lý do', tone: 'muted' };
  }
  const summary = loan.slaSummary;
  if (!summary) return { text: 'Chưa có dữ liệu SLA', tone: 'muted' };
  const cell = slaDeadlineCell(summary);
  if (summary.waitingEnterprise) return { text: `SLA tạm dừng, ${cell.detail}`, tone: 'muted' };
  if (summary.dueAt) return summary.isOverdue ? { text: `Hạn ${cell.text}`, tone: 'danger' } : { text: `Hạn ${cell.text}, ${cell.detail}`, tone: 'normal' };
  return { text: cell.detail ? `${cell.text}, ${cell.detail}` : cell.text, tone: cell.tone };
}

export function loanStageLine(loan: Pick<LoanApplication, 'currentStage' | 'currentStatus' | 'businessPolicyVersion' | 'reportStatus' | 'stageHistories'>) {
  const latest = loan.stageHistories?.[0];
  const handler = latest?.handler?.fullName || latest?.handler?.username || '';
  return {
    stage: stageLabel(loan.currentStage),
    time: latest?.enteredAt ? dateTimeText(latest.enteredAt) : '',
    note: !latest ? '' : loan.currentStage === 'THAM_DINH' ? reportStateLabel(loan) : handler,
  };
}

export const pageCount = ({ total, pageSize }: { total: number; pageSize: number }) => Math.max(1, Math.ceil(total / pageSize));
export function pageSummary({ total, page, pageSize }: { total: number; page: number; pageSize: number }): string {
  if (!total) return '0 hồ sơ';
  return `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} trên ${total} hồ sơ`;
}

export interface LoanFilterValues {
  code: string;
  company: string;
  stage: string;
  status: string;
  loanType: string;
  officer: string;
  overdueOnly: boolean;
}
export const EMPTY_LOAN_FILTERS: LoanFilterValues = { code: '', company: '', stage: '', status: '', loanType: '', officer: '', overdueOnly: false };

export function hasActiveFilters(filters: LoanFilterValues): boolean {
  return Object.values(filters).some(value => value === true || (typeof value === 'string' && value.trim() !== ''));
}

export function loanListQuery(filters: LoanFilterValues, page: number, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(LOAN_PAGE_SIZE) });
  for (const [key, value] of Object.entries(filters)) {
    if (value === true) params.set(key, 'true');
    else if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params.toString();
}

/** Số tiền rút gọn cho cột tổng quan; số đầy đủ nằm ở phần mở rộng của dòng. */
export function compactMoney(value?: number | string | null): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  const format = (number: number) => (Math.round(number * 100) / 100).toLocaleString('vi-VN');
  if (amount >= 1_000_000_000) return `${format(amount / 1_000_000_000)} tỷ`;
  if (amount >= 1_000_000) return `${format(amount / 1_000_000)} triệu`;
  return format(amount);
}
