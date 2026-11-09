import { Fragment, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronsUpDown, RefreshCw } from 'lucide-react';
import { isLoanFinished, loanTypeLabel, moneyText } from '../appraisalWorkspace';
import { compactMoney, loanStageLine, loanStatusDetail, loanStatusView, pageCount, pageSummary, stageProgress } from '../loanListDisplay';
import { alertDisplay, predictionHeadline, predictionLabel } from '../slaDisplay';
import type { LoanApplication } from '../types';
import { SupplementDeadlineBadge } from './SupplementDeadlineBadge';
import './loan-table.css';

export interface LoanColumn {
  label: string;
  render: (loan: LoanApplication) => ReactNode;
}

interface LoanTableProps {
  columns?: LoanColumn[];
  loans: LoanApplication[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string;
  hasFilter: boolean;
  emptyTitle: string;
  emptyDetail: string;
  onSelectLoan: (loanId: string) => void;
  onRefresh: () => void;
  onClearFilter: () => void;
  onPageChange: (page: number) => void;
}

function Message({ title, detail, action, span }: { title: string; detail?: string; action?: ReactNode; span: number }) {
  return <tr className="lt-message"><td colSpan={span}><strong>{title}</strong>{detail && <p>{detail}</p>}{action}</td></tr>;
}

export const codeColumn = (onSelectLoan: (loanId: string) => void): LoanColumn => ({
  label: 'Mã hồ sơ',
  render: loan => <>
    <button type="button" className="lt-code" onClick={event => { event.stopPropagation(); onSelectLoan(loan.id); }}>{loan.applicationCode}</button>
    <span className="lt-chip">{loan.source === 'PORTAL' ? 'Portal' : 'Tại quầy'}</span>
  </>,
});

export const companyColumn: LoanColumn = {
  label: 'Doanh nghiệp',
  render: loan => <>
    <span className="lt-clamp" title={loan.company.companyName}>{loan.company.companyName}</span>
    <span className="lt-sub">MST {loan.company.taxCode}</span>
  </>,
};

/** Mức cảnh báo của mô hình dự báo trễ SLA; chỉ hiện khi có dự báo và hồ sơ còn đang xử lý, Bình thường không chiếm chỗ. */
export function PredictionChip({ loan }: { loan: LoanApplication }) {
  const prediction = loan.delayPredictions?.[0];
  if (!prediction || isLoanFinished(loan) || loan.predictionStatus === 'INCOMPATIBLE_PA1') return null;
  const alert = alertDisplay(prediction.riskLevel, prediction.delayProbability, !!loan.slaSummary?.isOverdue);
  if (!alert || alert.code === 'BINH_THUONG' || (alert.code === 'QUA_HAN' && loan.slaSummary?.isOverdue)) return null;
  return <span className={`lt-status lt-status-${alert.tone}`} title={`Nguy cơ trễ SLA: ${predictionHeadline(prediction)}`}>{alert.label}</span>;
}

export function LoanStatusBadges({ loan }: { loan: LoanApplication }) {
  const status = loanStatusView(loan.currentStatus);
  return <div className="lt-badges">
    <span className={`lt-status lt-status-${status.tone}`}>{status.label}</span>
    {loan.slaSummary?.isOverdue && !isLoanFinished(loan) && <span className="lt-status lt-status-red">Quá hạn</span>}
    <PredictionChip loan={loan} />
    {loan.currentStatus === 'SUPPLEMENT_REQUIRED' && <SupplementDeadlineBadge requests={loan.supplementRequests} />}
  </div>;
}

const overviewColumns = (onSelectLoan: (loanId: string) => void): LoanColumn[] => [
  codeColumn(onSelectLoan),
  companyColumn,
  {
    label: 'Tiến trình',
    render: loan => {
      const stage = loanStageLine(loan);
      return <>
        <span className="lt-stage"><span className="lt-dot" aria-hidden="true" />{stage.stage}{stage.time && <span className="lt-sub lt-inline">{stage.time}</span>}</span>
        {stage.note && <span className="lt-sub lt-indent">{stage.note}</span>}
      </>;
    },
  },
  {
    label: 'Tổng quan',
    render: loan => <div className="lt-metrics">
      <div><strong>{compactMoney(loan.officialAmount || loan.proposedAmount)}</strong><span>Số tiền</span></div>
      <div><strong>{loan.loanTermMonths}</strong><span>Tháng</span></div>
      <div><strong>{loan.documentCount ?? 0}</strong><span>Tệp</span></div>
    </div>,
  },
  {
    label: 'Trạng thái',
    render: loan => {
      const status = loanStatusView(loan.currentStatus);
      const detail = loanStatusDetail(loan);
      const reached = stageProgress(loan.currentStage);
      return <>
        <LoanStatusBadges loan={loan} />
        <div className={`lt-progress lt-progress-${status.tone}`} role="img" aria-label={`Đã tới công đoạn ${reached} trên 3`}>{[1, 2, 3].map(step => <i key={step} className={step <= reached ? 'is-done' : ''} />)}</div>
        <span className={`lt-sub lt-tone-${detail.tone}`}>{detail.text}</span>
      </>;
    },
  },
];

function LoanDetails({ loan, onOpen }: { loan: LoanApplication; onOpen: () => void }) {
  const prediction = loan.delayPredictions?.[0];
  const hasPrediction = Boolean(prediction) && loan.predictionStatus !== 'INCOMPATIBLE_PA1';
  return <div className="lt-details">
    <dl>
      <div><dt>Số tiền đề xuất</dt><dd>{moneyText(loan.proposedAmount)}</dd></div>
      <div><dt>Hạn mức chính thức</dt><dd>{moneyText(loan.officialAmount)}</dd></div>
      <div><dt>Loại vay</dt><dd>{loanTypeLabel(loan.loanType)}</dd></div>
      <div><dt>Ngành nghề</dt><dd>{loan.company.industry || '—'}</dd></div>
      <div><dt>CBTD phụ trách</dt><dd>{loan.assignedUser?.fullName || 'Chưa phân công'}</dd></div>
      <div><dt>Ngày tạo</dt><dd>{new Date(loan.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</dd></div>
      <div><dt>Số lần bổ sung</dt><dd>{loan.supplementCount}</dd></div>
      <div><dt>Nguy cơ trễ SLA</dt><dd>{hasPrediction && prediction ? predictionHeadline(prediction, 0) : predictionLabel(loan.predictionStatus)}</dd></div>
    </dl>
    <button type="button" className="btn btn-secondary" onClick={onOpen}>Mở hồ sơ <ChevronRight size={14} aria-hidden="true" /></button>
  </div>;
}

export function LoanTable({ columns, loans, total, page, pageSize, loading, error, hasFilter, emptyTitle, emptyDetail, onSelectLoan, onRefresh, onClearFilter, onPageChange }: LoanTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const shown = columns ?? overviewColumns(onSelectLoan);
  const span = shown.length + 1;
  const allExpanded = loans.length > 0 && loans.every(loan => expanded.has(loan.id));
  const pages = pageCount({ total, pageSize });
  const toggle = (id: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return <>
    <div className="lt-toolbar">
      <span className="lt-summary" role="status">{loading ? 'Đang tải dữ liệu…' : pageSummary({ total, page, pageSize })}</span>
      <div className="lt-tools">
        <button type="button" className="lt-icon-button" disabled={loading} onClick={onRefresh} aria-label="Làm mới" title="Làm mới"><RefreshCw size={16} aria-hidden="true" /></button>
        <button type="button" className="lt-icon-button" disabled={!loans.length} aria-pressed={allExpanded} onClick={() => setExpanded(allExpanded ? new Set() : new Set(loans.map(loan => loan.id)))} aria-label={allExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'} title={allExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}><ChevronsUpDown size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <div className="lt-container">
      <table className={`lt-table${columns ? '' : ' lt-table-overview'}`} aria-busy={loading}>
        <thead><tr>
          <th scope="col"><span className="lt-sr-only">Mở rộng</span></th>
          {shown.map(column => <th key={column.label} scope="col">{column.label}</th>)}
        </tr></thead>
        <tbody>
          {loading && !loans.length && !error && [0, 1, 2, 3].map(row => <tr key={row} className="lt-skeleton" aria-hidden="true">{Array.from({ length: span }, (_, cell) => <td key={cell}><span /></td>)}</tr>)}
          {error && <Message span={span} title="Không tải được danh sách hồ sơ" detail={error} action={<button type="button" className="btn btn-secondary" onClick={onRefresh}>Thử lại</button>} />}
          {!error && !loading && !loans.length && (hasFilter
            ? <Message span={span} title="Không có hồ sơ phù hợp với bộ lọc" action={<button type="button" className="btn btn-secondary" onClick={onClearFilter}>Xóa bộ lọc</button>} />
            : <Message span={span} title={emptyTitle} detail={emptyDetail} />)}
          {!error && loans.map(loan => {
            const isOpen = expanded.has(loan.id);
            return <Fragment key={loan.id}>
              <tr className="lt-row" onClick={() => onSelectLoan(loan.id)}>
                <td className="lt-expand"><button type="button" className="lt-icon-button" aria-expanded={isOpen} aria-label={`${isOpen ? 'Thu gọn' : 'Mở rộng'} ${loan.applicationCode}`} onClick={event => { event.stopPropagation(); toggle(loan.id); }}>{isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</button></td>
                {shown.map(column => <td key={column.label} data-label={column.label}>{column.render(loan)}</td>)}
              </tr>
              {isOpen && <tr className="lt-detail-row"><td colSpan={span}><LoanDetails loan={loan} onOpen={() => onSelectLoan(loan.id)} /></td></tr>}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
    {pages > 1 && <nav className="lt-pagination" aria-label="Phân trang">
      <button type="button" className="btn btn-secondary" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>Trang trước</button>
      <span>Trang {page} / {pages}</span>
      <button type="button" className="btn btn-secondary" disabled={loading || page >= pages} onClick={() => onPageChange(page + 1)}>Trang sau</button>
    </nav>}
  </>;
}
