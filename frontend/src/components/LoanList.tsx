import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api/client';
import { startAutoRefresh } from '../autoRefresh';
import { lookupDecision } from '../appraisalQueue';
import { useAuth } from '../context/AuthContext';
import { EMPTY_LOAN_FILTERS, hasActiveFilters, LOAN_PAGE_SIZE, loanListQuery, loanStatusDetail, pageCount, stageLabel, type LoanFilterValues } from '../loanListDisplay';
import { isLoanFinished } from '../appraisalWorkspace';
import type { LoanApplication } from '../types';
import { LoanFilters } from './LoanFilters';
import { codeColumn, companyColumn, LoanStatusBadges, LoanTable, type LoanColumn } from './LoanTable';
import { PortalIntakeQueue } from './PortalIntakeQueue';

interface LoanListProps {
  onSelectLoan: (loanId: string) => void;
  onOpenCreate: () => void;
  refreshKey: number;
  intakeTarget?: { id: string; revision: number } | null;
}

interface LoanPage { items: LoanApplication[]; total: number; page: number; pageSize: number }

const APPRAISAL_STATUSES: ReadonlyArray<readonly [string, string]> = [['PENDING_APPRAISAL', 'Đang thẩm định'], ['SUPPLEMENT_REQUIRED', 'Chờ bổ sung']];
const FINISHED_STATUSES: ReadonlyArray<readonly [string, string]> = [['APPROVED', 'Đã phê duyệt'], ['REJECTED', 'Bị từ chối'], ['CLOSED_TIMEOUT', 'Đã đóng do quá hạn']];
const RECEPTION_STATUSES: ReadonlyArray<readonly [string, string]> = [['RECEIVED', 'Mới tiếp nhận'], ['CHECKED', 'Đã đủ hồ sơ']];
const RECEPTION_STAGE: readonly [string, string] = ['TIEP_NHAN', 'Tiếp nhận'];
const LATER_STAGES: ReadonlyArray<readonly [string, string]> = [['THAM_DINH', 'Thẩm định'], ['HOAN_TAT', 'Hoàn tất']];
const LOOKUP_ORDER = { sort: 'updated' };

const lookupColumns = (onSelectLoan: (loanId: string) => void): LoanColumn[] => [
  codeColumn(onSelectLoan),
  companyColumn,
  {
    label: 'Trạng thái',
    render: loan => <>
      <LoanStatusBadges loan={loan} />
      <span className="lt-sub">{stageLabel(loan.currentStage)}</span>
    </>,
  },
  { label: 'Kết quả', render: loan => (isLoanFinished(loan) ? loanStatusDetail(loan).text : '—') },
  {
    label: 'Người quyết định',
    render: loan => {
      const decision = lookupDecision(loan);
      return <>
        <span>{decision.by}</span>
        {decision.time && <span className="lt-sub">{decision.time}</span>}
      </>;
    },
  },
  {
    label: 'Thao tác',
    render: loan => <button type="button" className="btn btn-secondary lt-action" onClick={event => { event.stopPropagation(); onSelectLoan(loan.id); }}>Xem</button>,
  },
];

export const LoanList: React.FC<LoanListProps> = ({ onSelectLoan, onOpenCreate, refreshKey, intakeTarget }) => {
  const { activeRole } = useAuth();
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<LoanFilterValues>(EMPTY_LOAN_FILTERS);
  const [applied, setApplied] = useState<LoanFilterValues>(EMPTY_LOAN_FILTERS);
  const [page, setPage] = useState(1);
  const [intakeTab, setIntakeTab] = useState(false);
  useEffect(() => { if (intakeTarget) setIntakeTab(true); }, [intakeTarget]);

  const isAuthority = activeRole === 'THAM_QUYEN';
  const showIntake = !isAuthority;
  const requestId = useRef(0);

  const fetchLoans = useCallback(async (quiet = false) => {
    const currentRequest = ++requestId.current;
    if (!quiet) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await api.get<LoanPage>(`/loan-applications?${loanListQuery(applied, page, isAuthority ? LOOKUP_ORDER : {})}`);
      if (currentRequest !== requestId.current) return;
      const lastPage = pageCount({ total: data.total, pageSize: data.pageSize });
      if (page > lastPage) { setPage(lastPage); return; }
      setLoans(data.items);
      setTotal(data.total);
    } catch (err) {
      if (!quiet && currentRequest === requestId.current) { setError((err as Error).message); setLoans([]); setTotal(0); }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [applied, isAuthority, page]);

  useEffect(() => { void fetchLoans(); }, [fetchLoans, refreshKey]);
  useEffect(() => startAutoRefresh({ refresh: () => { void fetchLoans(true); } }), [fetchLoans]);

  const applyFilters = () => { setPage(1); setApplied({ ...draft }); };
  const clearFilters = () => { setDraft(EMPTY_LOAN_FILTERS); setPage(1); setApplied(EMPTY_LOAN_FILTERS); };

  const stageOptions = isAuthority ? LATER_STAGES : [RECEPTION_STAGE, ...LATER_STAGES];
  const statusOptions = isAuthority ? [...APPRAISAL_STATUSES, ...FINISHED_STATUSES] : [...RECEPTION_STATUSES, ...APPRAISAL_STATUSES, ...FINISHED_STATUSES];
  const subtitle = isAuthority ? 'Tra cứu hồ sơ từ công đoạn Thẩm định trở đi; mới cập nhật xếp trước' : 'Hồ sơ quá hạn và sắp đến hạn xếp trước; hồ sơ đã kết thúc xếp sau';

  return (
    <div className="loan-list-view">
      {showIntake && <div className="portal-tabs"><button className={`btn ${!intakeTab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setIntakeTab(false); void fetchLoans(true); }}>Hồ sơ đang quản lý</button><button className={`btn ${intakeTab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIntakeTab(true)}>Chờ tiếp nhận</button></div>}
      {showIntake && intakeTab ? <PortalIntakeQueue activeRole={activeRole} target={intakeTarget} onSelectLoan={onSelectLoan} onRefresh={() => { void fetchLoans(); }} /> : <>
        <div className="page-heading loan-page-heading">
          <div>
            <h2>Danh sách hồ sơ</h2>
            <p>{subtitle}</p>
          </div>
          {activeRole === 'CBTD' && <div className="page-actions"><button onClick={onOpenCreate} className="btn btn-primary"><Plus size={16} aria-hidden="true" /> Tạo hồ sơ vay mới</button></div>}
        </div>
        <LoanFilters values={draft} stageOptions={stageOptions} statusOptions={statusOptions} showOfficer={activeRole !== 'CBTD'} busy={loading} onChange={setDraft} onApply={applyFilters} onClear={clearFilters} />
        <LoanTable
          columns={isAuthority ? lookupColumns(onSelectLoan) : undefined}
          loans={loans}
          total={total}
          page={page}
          pageSize={LOAN_PAGE_SIZE}
          loading={loading}
          error={error}
          hasFilter={hasActiveFilters(applied)}
          emptyTitle="Hiện chưa có hồ sơ"
          emptyDetail={activeRole === 'CBTD' ? 'Hồ sơ được phân công cho bạn sẽ xuất hiện tại đây.' : 'Hồ sơ sẽ xuất hiện tại đây khi được tiếp nhận.'}
          onSelectLoan={onSelectLoan}
          onRefresh={() => { void fetchLoans(); }}
          onClearFilter={clearFilters}
          onPageChange={next => { setPage(next); window.scrollTo({ top: 0 }); }}
        />
      </>}
    </div>
  );
};
