import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { DEFAULT_QUEUE_TAB, QUEUE_EMPTY, queueActionLabel, queueReportLines, resolveQueueTab, visibleQueueTabs, type QueueCounts, type QueueGroup } from '../appraisalQueue';
import { useAuth } from '../context/AuthContext';
import { compactMoney, EMPTY_LOAN_FILTERS, hasActiveFilters, LOAN_PAGE_SIZE, loanListQuery, pageCount, type LoanFilterValues } from '../loanListDisplay';
import { slaDeadlineCell } from '../slaDisplay';
import type { LoanApplication } from '../types';
import { LoanFilters } from './LoanFilters';
import { codeColumn, companyColumn, LoanTable, type LoanColumn } from './LoanTable';
import './loan-table.css';

interface QueuePage { items: LoanApplication[]; total: number; page: number; pageSize: number; groupCounts: QueueCounts }

interface AppraisalQueueProps {
  refreshKey: number;
  onSelectLoan: (loanId: string) => void;
}

export const AppraisalQueue: React.FC<AppraisalQueueProps> = ({ refreshKey, onSelectLoan }) => {
  const { activeRole } = useAuth();
  const [tab, setTab] = useState<QueueGroup>(DEFAULT_QUEUE_TAB);
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<LoanFilterValues>(EMPTY_LOAN_FILTERS);
  const [applied, setApplied] = useState<LoanFilterValues>(EMPTY_LOAN_FILTERS);
  const [page, setPage] = useState(1);
  const requestId = useRef(0);

  const fetchQueue = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const data = await api.get<QueuePage>(`/loan-applications?${loanListQuery(applied, page, { queue: tab })}`);
      if (currentRequest !== requestId.current) return;
      setCounts(data.groupCounts);
      const nextTab = resolveQueueTab(tab, data.groupCounts);
      if (nextTab !== tab) { setPage(1); setTab(nextTab); return; }
      const lastPage = pageCount({ total: data.total, pageSize: data.pageSize });
      if (page > lastPage) { setPage(lastPage); return; }
      setLoans(data.items);
      setTotal(data.total);
    } catch (err) {
      if (currentRequest === requestId.current) { setError((err as Error).message); setLoans([]); setTotal(0); }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [applied, page, tab]);

  useEffect(() => { void fetchQueue(); }, [fetchQueue, refreshKey]);

  const selectTab = (next: QueueGroup) => {
    if (next === tab) return;
    setPage(1);
    setLoans([]);
    setTab(next);
  };
  const applyFilters = () => { setPage(1); setApplied({ ...draft }); };
  const clearFilters = () => { setDraft(EMPTY_LOAN_FILTERS); setPage(1); setApplied(EMPTY_LOAN_FILTERS); };

  const columns: LoanColumn[] = [
    codeColumn(onSelectLoan),
    companyColumn,
    {
      label: 'Hạn SLA',
      render: loan => {
        const cell = slaDeadlineCell(loan.slaSummary);
        return <>
          <span className={`lt-tone-${cell.tone}`}>{cell.text}</span>
          {cell.detail && <span className={`lt-sub lt-tone-${cell.tone}`}>{cell.detail}</span>}
        </>;
      },
    },
    { label: 'Số tiền đề xuất', render: loan => compactMoney(loan.proposedAmount) },
    {
      label: 'Tờ trình',
      render: loan => {
        const report = queueReportLines(loan);
        return <>
          <span>{report.title}</span>
          {report.time && <span className="lt-sub">Trình lúc {report.time}</span>}
          {report.note && <span className="lt-sub">{report.note}</span>}
        </>;
      },
    },
    { label: 'CBTD', render: loan => loan.assignedUser?.fullName || 'Chưa phân công' },
    {
      label: 'Thao tác',
      render: loan => <button type="button" className="btn btn-secondary lt-action" onClick={event => { event.stopPropagation(); onSelectLoan(loan.id); }}>{queueActionLabel(activeRole, tab)}</button>,
    },
  ];

  return (
    <div className="loan-list-view">
      <div className="page-heading loan-page-heading">
        <div>
          <h2>Thẩm định &amp; phê duyệt</h2>
        </div>
      </div>
      <div className="lt-queue-tabs" role="tablist" aria-label="Nhóm hồ sơ">
        {visibleQueueTabs(counts).map(item => <button key={item.group} type="button" role="tab" className="lt-queue-tab" aria-selected={item.group === tab} onClick={() => selectTab(item.group)}>
          {item.label}<span className="lt-queue-count">{item.count}</span>
        </button>)}
      </div>
      <LoanFilters minimal values={draft} stageOptions={[]} statusOptions={[]} showOfficer={false} busy={loading} onChange={setDraft} onApply={applyFilters} onClear={clearFilters} />
      <LoanTable
        columns={columns}
        loans={loans}
        total={total}
        page={page}
        pageSize={LOAN_PAGE_SIZE}
        loading={loading}
        error={error}
        hasFilter={hasActiveFilters(applied)}
        emptyTitle={QUEUE_EMPTY[tab].title}
        emptyDetail={QUEUE_EMPTY[tab].detail}
        onSelectLoan={onSelectLoan}
        onRefresh={() => { void fetchQueue(); }}
        onClearFilter={clearFilters}
        onPageChange={next => { setPage(next); window.scrollTo({ top: 0 }); }}
      />
    </div>
  );
};
