import React, { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api/client';
import { startAutoRefresh } from '../autoRefresh';
import { lookupDecision } from '../appraisalQueue';
import { useAuth } from '../context/AuthContext';
import { EMPTY_LOAN_FILTERS, hasActiveFilters, LOAN_PAGE_SIZE, loanListQuery, loanStatusDetail, pageCount, stageLabel, type LoanFilterValues, type StatusGroup } from '../loanListDisplay';
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
  /** Khối hiển thị ngay trên bộ lọc của tab hồ sơ đang quản lý. */
  priority?: ReactNode;
}

interface LoanPage { items: LoanApplication[]; total: number; page: number; pageSize: number }

const APPRAISAL_STATUSES: ReadonlyArray<readonly [string, string]> = [['PENDING_APPRAISAL', 'Đang thẩm định'], ['SUPPLEMENT_REQUIRED', 'Chờ bổ sung']];
const FINISHED_STATUSES: ReadonlyArray<readonly [string, string]> = [['APPROVED', 'Đã phê duyệt'], ['REJECTED', 'Bị từ chối'], ['CLOSED_TIMEOUT', 'Đã đóng do quá hạn']];
const RECEPTION_STATUSES: ReadonlyArray<readonly [string, string]> = [['RECEIVED', 'Mới tiếp nhận'], ['CHECKED', 'Đã đủ hồ sơ']];
const RECEPTION_STAGE: readonly [string, string] = ['TIEP_NHAN', 'Tiếp nhận'];
const LATER_STAGES: ReadonlyArray<readonly [string, string]> = [['THAM_DINH', 'Thẩm định'], ['HOAN_TAT', 'Hoàn tất']];
const LOOKUP_ORDER = { sort: 'updated' };
type OfficerView = 'active' | 'finished';
const OFFICER_STATUSES: Record<OfficerView, ReadonlyArray<readonly [string, string]>> = {
  active: [['RECEIVED', 'Mới tiếp nhận'], ['CHECKED', 'Đã đủ hồ sơ'], ['SUPPLEMENT_REQUIRED', 'Chờ bổ sung'], ['PENDING_APPRAISAL', 'Đang thẩm định']],
  finished: FINISHED_STATUSES,
};
const AUTHORITY_STATUS_GROUPS: ReadonlyArray<StatusGroup> = [
  { stage: 'THAM_DINH', label: 'Thẩm định', statuses: [['PENDING_APPRAISAL', 'Đang thẩm định'], ['SUPPLEMENT_REQUIRED', 'Chờ bổ sung']] },
  { stage: 'HOAN_TAT', label: 'Hoàn tất', statuses: FINISHED_STATUSES },
];

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

export const LoanList: React.FC<LoanListProps> = ({ onSelectLoan, onOpenCreate, refreshKey, intakeTarget, priority }) => {
  const { activeRole } = useAuth();
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<LoanFilterValues>(EMPTY_LOAN_FILTERS);
  const [applied, setApplied] = useState<LoanFilterValues>(EMPTY_LOAN_FILTERS);
  const [page, setPage] = useState(1);
  const [intakeTab, setIntakeTab] = useState(false);
  const [officerView, setOfficerView] = useState<OfficerView>('active');
  useEffect(() => { if (intakeTarget) setIntakeTab(true); }, [intakeTarget]);

  const isAuthority = activeRole === 'THAM_QUYEN';
  const isOfficer = activeRole === 'CBTD';
  const showIntake = !isAuthority;
  const requestId = useRef(0);

  const fetchLoans = useCallback(async (quiet = false) => {
    const currentRequest = ++requestId.current;
    if (!quiet) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await api.get<LoanPage>(`/loan-applications?${loanListQuery(applied, page, isAuthority ? LOOKUP_ORDER : isOfficer ? { lifecycle: officerView } : {})}`);
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
  }, [applied, isAuthority, isOfficer, officerView, page]);

  useEffect(() => { void fetchLoans(); }, [fetchLoans, refreshKey]);
  useEffect(() => startAutoRefresh({ refresh: () => { void fetchLoans(true); } }), [fetchLoans]);

  const applyFilters = () => { setPage(1); setApplied({ ...draft }); };
  const openOfficerView = (view: OfficerView) => { setIntakeTab(false); setOfficerView(view); setDraft(EMPTY_LOAN_FILTERS); setApplied(EMPTY_LOAN_FILTERS); setPage(1); };
  const clearFilters = () => { setDraft(EMPTY_LOAN_FILTERS); setPage(1); setApplied(EMPTY_LOAN_FILTERS); };

  const stageOptions = isAuthority ? LATER_STAGES : [RECEPTION_STAGE, ...LATER_STAGES];
  const statusOptions = isAuthority ? [...APPRAISAL_STATUSES, ...FINISHED_STATUSES] : [...RECEPTION_STATUSES, ...APPRAISAL_STATUSES, ...FINISHED_STATUSES];

  return (
    <div className="loan-list-view">
      {isOfficer && <div className="page-heading loan-page-heading">
        <div>
          <h2>Hồ sơ của tôi</h2>
        </div>
        <div className="page-actions"><button onClick={onOpenCreate} className="btn btn-primary"><Plus size={16} aria-hidden="true" /> Tạo hồ sơ vay mới</button></div>
      </div>}
      {isOfficer && <div className="portal-tabs" role="tablist" aria-label="Nhóm hồ sơ">
        {(['active', 'finished'] as const).map(view => <button key={view} type="button" role="tab" aria-selected={!intakeTab && officerView === view} className={`btn ${!intakeTab && officerView === view ? 'btn-primary' : 'btn-secondary'}`} onClick={() => openOfficerView(view)}>{view === 'active' ? 'Đang xử lý' : 'Đã kết thúc'}</button>)}
        <button type="button" role="tab" aria-selected={intakeTab} className={`btn ${intakeTab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIntakeTab(true)}>Chờ tiếp nhận</button>
      </div>}
      {showIntake && !isOfficer && <div className="portal-tabs"><button className={`btn ${!intakeTab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setIntakeTab(false); void fetchLoans(true); }}>Hồ sơ đang quản lý</button><button className={`btn ${intakeTab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIntakeTab(true)}>Chờ tiếp nhận</button></div>}
      {showIntake && intakeTab ? <PortalIntakeQueue activeRole={activeRole} target={intakeTarget} onSelectLoan={onSelectLoan} onRefresh={() => { void fetchLoans(); }} /> : <>
        {!isOfficer && <div className="page-heading loan-page-heading">
          <div>
            <h2>Danh sách hồ sơ</h2>
          </div>
        </div>}
        {(!isOfficer || officerView === 'active') && priority}
        <LoanFilters panel={isOfficer || isAuthority} statusGroups={isAuthority ? AUTHORITY_STATUS_GROUPS : undefined} values={draft} stageOptions={isOfficer ? [] : stageOptions} statusOptions={isOfficer ? OFFICER_STATUSES[officerView] : statusOptions} showOfficer={!isOfficer} busy={loading} onChange={setDraft} onApply={applyFilters} onClear={clearFilters} />
        <LoanTable
          columns={isAuthority ? lookupColumns(onSelectLoan) : undefined}
          loans={loans}
          total={total}
          page={page}
          pageSize={LOAN_PAGE_SIZE}
          loading={loading}
          error={error}
          hasFilter={hasActiveFilters(applied)}
          emptyTitle={isOfficer && officerView === 'finished' ? 'Chưa có hồ sơ đã kết thúc' : 'Hiện chưa có hồ sơ'}
          emptyDetail={isOfficer ? 'Hồ sơ được phân công cho bạn sẽ xuất hiện tại đây.' : 'Hồ sơ sẽ xuất hiện tại đây khi được tiếp nhận.'}
          onSelectLoan={onSelectLoan}
          onRefresh={() => { void fetchLoans(); }}
          onClearFilter={clearFilters}
          onPageChange={next => { setPage(next); window.scrollTo({ top: 0 }); }}
        />
      </>}
    </div>
  );
};
