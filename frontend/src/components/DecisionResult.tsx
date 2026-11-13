import { bandText, rateText as formatRate, REJECTION_REASONS } from '../appraisalWorkspace';
import type { LoanApplication } from '../types';

const OUTCOME_TITLES: Record<string, string> = {
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Đã từ chối',
  CLOSED_TIMEOUT: 'Đã đóng do quá hạn bổ sung',
};
const NOT_RECORDED = 'Chưa ghi nhận';

const moneyText = (value?: number | string) => value === undefined || value === null ? NOT_RECORDED : `${Number(value).toLocaleString('vi-VN')} VNĐ`;
const rateText = (value?: number | string) => value === undefined || value === null ? NOT_RECORDED : `${Number(value).toLocaleString('vi-VN')}%/năm`;
const dateText = (value?: string) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : NOT_RECORDED;
const reasonText = (code?: string) => !code ? NOT_RECORDED : REJECTION_REASONS[code] ? `${code} - ${REJECTION_REASONS[code]}` : code;

function Row({ label, value }: { label: string; value: string }) {
  return <div><dt style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</dt><dd style={{ margin: '2px 0 0', fontWeight: 600, whiteSpace: 'pre-wrap' }}>{value}</dd></div>;
}

export function DecisionResult({ loan }: { loan: LoanApplication }) {
  const title = OUTCOME_TITLES[loan.currentStatus];
  if (!title) return null;
  const closing = [...(loan.stageHistories ?? [])].reverse().find(history => history.stage?.stageCode === 'HOAN_TAT');
  const decider = closing?.handler?.fullName || closing?.handler?.username || NOT_RECORDED;
  return <section className="card" aria-label="Kết quả quyết định" style={{ padding: 20 }}>
    <h3>Kết quả quyết định: {title}</h3>
    <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '12px 0 0' }}>
      {loan.currentStatus === 'APPROVED' ? <>
        <Row label="Số tiền phê duyệt" value={moneyText(loan.approvedAmount)} />
        <Row label="Lãi suất phê duyệt" value={rateText(loan.interestRate)} />
        {loan.rateDecision?.proposedInterestRate != null && <Row label="Lãi suất CBTD đề xuất" value={formatRate(loan.rateDecision.proposedInterestRate)} />}
        {loan.rateDecision?.interestRateReason && <Row label="Lý do khác mức đề xuất" value={loan.rateDecision.interestRateReason} />}
        {loan.rateDecision?.band && <Row label="Khung áp dụng" value={`${bandText(loan.rateDecision.band)} (${loan.rateDecision.band.basis})`} />}
      </> : <>
        <Row label="Mã lý do" value={reasonText(loan.rejectionReasonCode)} />
        <Row label="Giải trình" value={loan.rejectionNote || NOT_RECORDED} />
      </>}
      <Row label="Người quyết định" value={decider} />
      <Row label="Thời điểm" value={dateText(loan.completedAt ?? closing?.exitedAt)} />
    </dl>
  </section>;
}
