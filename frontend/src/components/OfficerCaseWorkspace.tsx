import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, X } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { debtToEquityText, loanTypeLabel, moneyText, riskLabel, type AppraisalReportView } from '../appraisalWorkspace';
import { LEAVE_WARNING, officerAccess } from '../officerCase';
import { predictionLabel, slaDeadlineCell, slaSummaryText } from '../slaDisplay';
import type { PortalFormConfig } from '../portal/model';
import type { LoanApplication } from '../types';
import { AppraisalEvidenceTabs, type EvidenceTab } from './AppraisalEvidenceTabs';
import { AppraisalReportCard } from './AppraisalReportCard';
import { resolveLoanId } from './AppraisalWorkspace';
import { AssignmentChangeRequestPanel } from './AssignmentChangeRequestPanel';
import { CaseStageProgress } from './CaseStageProgress';
import { DecisionResult } from './DecisionResult';
import { documentTypeName } from './loanInputRules';
import { LoanStatusBadges } from './LoanTable';
import { OfficerDocumentToolbar } from './OfficerDocumentToolbar';
import { OfficerReportEditor } from './OfficerReportEditor';
import { OfficerTaskPanel } from './OfficerTaskPanel';
import { PortalIntakeDetails } from './PortalIntakeDetails';
import './appraisal-workspace.css';

interface OfficerCaseWorkspaceProps {
  reference: string;
  refreshKey: number;
  onBack: () => void;
  onResolved: (applicationCode: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}

const BRANCH_LIMIT = 10_000_000_000;
const HIGH_LEVERAGE = 2;

function loadErrorMessage(error: unknown): { title: string; detail: string; retry: boolean } {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 403) return { title: 'Bạn không có quyền xem hồ sơ này', detail: 'Hồ sơ không do bạn phụ trách. Liên hệ Quản lý nếu cần được phân công.', retry: false };
  if (status === 404) return { title: 'Không tìm thấy hồ sơ', detail: 'Hồ sơ không tồn tại, không do bạn phụ trách hoặc địa chỉ không đúng.', retry: false };
  return { title: 'Không tải được hồ sơ', detail: (error as Error).message, retry: true };
}

export function OfficerCaseWorkspace({ reference, refreshKey, onBack, onResolved, onDirtyChange }: OfficerCaseWorkspaceProps) {
  const { user } = useAuth();
  const [loan, setLoan] = useState<LoanApplication | null>(null);
  const [report, setReport] = useState<AppraisalReportView | null>(null);
  const [config, setConfig] = useState<PortalFormConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [loadError, setLoadError] = useState<ReturnType<typeof loadErrorMessage> | null>(null);
  const [refreshError, setRefreshError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [reportDirty, setReportDirty] = useState(false);
  const [amountDirty, setAmountDirty] = useState(false);
  const [requestedTab, setRequestedTab] = useState<{ tab: EvidenceTab; nonce: number } | undefined>();
  const request = useRef(0);
  const loanId = useRef<string | null>(null);
  const configLoaded = useRef(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  const dirty = reportDirty || amountDirty;

  const load = useCallback(async () => {
    const current = ++request.current;
    const firstLoad = !loanId.current;
    if (!firstLoad) setRefreshing(true);
    try {
      const id = loanId.current ?? await resolveLoanId(reference);
      const detail = await api.get<LoanApplication>(`/loan-applications/${id}`);
      const nextReport = detail.businessPolicyVersion ? await api.get<AppraisalReportView | null>(`/appraisals/${id}`) : null;
      if (current !== request.current) return;
      loanId.current = id;
      setLoan(detail);
      setReport(nextReport ?? null);
      setLoadError(null);
      setRefreshError('');
      onResolved(detail.applicationCode);
      if (detail.portalRequest && !configLoaded.current) {
        try {
          const nextConfig = await api.get<PortalFormConfig>('/portal-intakes/form-config');
          if (current === request.current) { configLoaded.current = true; setConfig(nextConfig); setConfigError(''); }
        } catch (err) { if (current === request.current) setConfigError((err as Error).message); }
      }
    } catch (err) {
      if (current !== request.current) return;
      const failure = loadErrorMessage(err);
      if (firstLoad || !failure.retry) {
        loanId.current = null;
        setLoan(null);
        setReport(null);
        setLoadError(failure);
      } else setRefreshError(`Không cập nhật được hồ sơ: ${failure.detail} Nội dung đang nhập vẫn được giữ.`);
    } finally {
      if (current === request.current) setRefreshing(false);
    }
  }, [reference, onResolved]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [reference]);
  useEffect(() => {
    void load();
    return () => { request.current++; };
  }, [load, refreshKey]);

  useEffect(() => {
    onDirtyChange(dirty);
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = LEAVE_WARNING; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const run = useCallback(async (work: () => Promise<unknown>, success: string) => {
    setBusy(true); setActionError(''); setNotice('');
    let done = true;
    try {
      await work();
      setNotice(success);
    } catch (err) {
      done = false;
      setActionError((err as Error).message);
    }
    await load();
    setBusy(false);
    return done;
  }, [load]);

  const keepReport = useCallback((next: AppraisalReportView) => setReport(previous => ({ ...previous, ...next })), []);
  const showTab = (tab: EvidenceTab) => {
    setRequestedTab(previous => ({ tab, nonce: (previous?.nonce ?? 0) + 1 }));
    evidenceRef.current?.scrollIntoView({ block: 'start' });
  };

  if (loadError) return <div className="aw-page oc-page">
    <button type="button" className="btn btn-secondary aw-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Danh sách</button>
    <section className="card aw-card aw-state" role="alert">
      <h1 className="aw-state-title">{loadError.title}</h1>
      <p>{loadError.detail}</p>
      {loadError.retry && <button type="button" className="btn btn-primary" onClick={() => { setLoadError(null); void load(); }}>Thử lại</button>}
    </section>
  </div>;

  if (!loan) return <div className="aw-page oc-page" aria-busy="true">
    <p role="status" className="aw-sr-only">Đang tải hồ sơ…</p>
    <div className="aw-skeleton aw-skeleton-header" />
    <div className="aw-layout"><div className="aw-skeleton aw-skeleton-main" /><div className="aw-skeleton aw-skeleton-side" /></div>
  </div>;

  const access = officerAccess(loan, report, user?.id);
  const deadline = slaDeadlineCell(access.finished ? null : loan.slaSummary);
  const prediction = loan.delayPredictions?.[0];
  const hasPrediction = Boolean(prediction) && loan.predictionStatus !== 'INCOMPATIBLE_PA1';
  let reasons: string[] = [];
  if (hasPrediction && prediction?.topReasonsJson) {
    try { reasons = JSON.parse(prediction.topReasonsJson); } catch { reasons = [prediction.topReasonsJson]; }
  }
  const capital = Number(loan.company.charterCapital);
  const highLeverage = capital > 0 && Number(loan.proposedAmount) / capital > HIGH_LEVERAGE;
  const overLimit = Number(loan.officialAmount || loan.proposedAmount) > BRANCH_LIMIT;
  const versions = report?.versions ?? [];

  const deleteDocument = (documentId: string) => {
    if (!window.confirm('Xóa tài liệu này khỏi hồ sơ?')) return;
    void run(() => api.delete(`/documents/${documentId}`), 'Đã xóa chứng từ.');
  };

  return <div className="aw-page oc-page">
    <header className="aw-header">
      <button type="button" className="btn btn-secondary aw-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Danh sách</button>
      <div className="aw-header-main">
        <div className="aw-header-title">
          <h1>{loan.applicationCode}</h1>
          <LoanStatusBadges loan={loan} />
          {!loan.businessPolicyVersion && <span className="badge badge-soft-gray">Quy trình cũ</span>}
          {loan.source === 'QUAY' && <span className="badge badge-soft-gray">Tạo tại quầy</span>}
          {loan.source === 'PORTAL' && <span className="badge badge-soft-gray">Từ Portal</span>}
          {loan.supplementCount > 0 && <span className="badge badge-soft-gray">Đã bổ sung {loan.supplementCount} lần</span>}
        </div>
        <p>{loan.company.companyName} · MST {loan.company.taxCode}</p>
      </div>
      {!access.finished && <div className={`aw-header-deadline aw-tone-${deadline.tone}`}>
        <span className="aw-label">Hạn SLA</span>
        <strong>{deadline.text}</strong>
        {deadline.detail && <span>{deadline.detail}</span>}
      </div>}
      <button type="button" className={`btn btn-secondary aw-refresh${refreshing ? ' oc-refreshing' : ''}`} disabled={busy || refreshing} aria-busy={refreshing} onClick={() => void load()} aria-label={refreshing ? 'Đang tải lại hồ sơ' : 'Tải lại hồ sơ'}><RefreshCw size={16} aria-hidden="true" /></button>
    </header>

    {(notice || actionError || refreshError) && <div className="oc-feedback">
      {notice && <p role="status" className="aw-alert aw-alert-success"><span>{notice}</span><button type="button" className="oc-dismiss" aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={16} aria-hidden="true" /></button></p>}
      {actionError && <p role="alert" className="aw-alert aw-alert-danger"><span>{actionError}</span><button type="button" className="oc-dismiss" aria-label="Đóng thông báo lỗi" onClick={() => setActionError('')}><X size={16} aria-hidden="true" /></button></p>}
      {refreshError && <p role="alert" className="aw-alert aw-alert-warning"><span>{refreshError}</span><button type="button" className="btn btn-secondary" disabled={refreshing} onClick={() => void load()}>Thử lại</button></p>}
    </div>}

    <CaseStageProgress loan={loan} />

    <div className="aw-layout">
      <div className="aw-main">
        {access.finished && <DecisionResult loan={loan} />}

        <div ref={reportRef} className="oc-anchor">
          {loan.businessPolicyVersion && access.canEditReport
            ? <OfficerReportEditor loan={loan} report={report} busy={busy} run={run} onReport={keepReport} onDirtyChange={setReportDirty} />
            : <AppraisalReportCard key={versions[0]?.id ?? 'empty'} loan={loan} report={report} finished={access.finished} />}
        </div>
        {access.canEditReport && versions.length > 0 && <details className="card aw-card">
          <summary>Các phiên bản đã trình ({versions.length})</summary>
          <AppraisalReportCard key={versions[0].id} loan={loan} report={report} finished={access.finished} />
        </details>}

        {loan.portalRequest?.formVersion === 2 && <details className="card aw-card portal-intake">
          <summary>Đề nghị gốc từ cổng doanh nghiệp · {loan.portalRequest.reference}</summary>
          {configError && <p role="alert" className="aw-alert aw-alert-danger">Không tải được danh mục tài liệu: {configError}</p>}
          <PortalIntakeDetails request={loan.portalRequest} config={config} busy={busy} />
        </details>}

        <div ref={evidenceRef} className="oc-anchor">
          <AppraisalEvidenceTabs
            loan={loan}
            canEdit={access.reception}
            config={config}
            onChanged={() => { void load(); }}
            requestedTab={requestedTab}
            documentToolbar={access.reception ? <OfficerDocumentToolbar loanId={loan.id} busy={busy} run={run} /> : undefined}
            onDeleteDocument={access.reception ? deleteDocument : undefined}
            deleteDisabled={busy}
            supplementTypeName={code => documentTypeName(config, code)}
            timelineNote={<>
              <p className="aw-hint"><strong>Tình trạng SLA hiện tại: </strong>{slaSummaryText(loan.slaSummary, access.finished)}</p>
              {loan.liveSla?.error && <p role="alert" className="aw-field-error">{loan.liveSla.error}</p>}
            </>}
          />
        </div>

        <AssignmentChangeRequestPanel key={`coordination:${loan.id}`} subject={{ type: 'LOAN', id: loan.id, assignmentVersion: loan.assignmentVersion, ownerId: loan.assignedTo, closed: access.finished }} onChanged={() => load()} />

        {Boolean(loan.assignments?.length) && <details className="card aw-card">
          <summary>Lịch sử bàn giao hồ sơ ({loan.assignments?.length})</summary>
          <ol className="oc-history">
            {loan.assignments?.map(entry => <li key={entry.id}>
              <strong>{entry.fromUser?.fullName || 'Chưa phân công'} → {entry.toUser?.fullName || entry.toUser.username}</strong>
              <p className="aw-hint">{new Date(entry.reassignedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · Quản lý: {entry.manager?.fullName || entry.manager.username}</p>
              <p className="aw-hint">Lý do: {entry.reason}</p>
            </li>)}
          </ol>
        </details>}
      </div>

      <aside className="aw-side">
        <OfficerTaskPanel
          loan={loan}
          report={report}
          access={access}
          busy={busy}
          run={run}
          onShowDocuments={() => showTab('documents')}
          onShowSupplements={() => showTab('supplements')}
          onShowReport={() => reportRef.current?.scrollIntoView({ block: 'start' })}
          onDirtyChange={setAmountDirty}
        />
        <section className="card aw-card aw-info" aria-label="Thông tin khoản vay">
          <h2 className="aw-card-title">Khoản vay</h2>
          <dl className="aw-facts">
            <div className="aw-fact-strong"><dt>Hạn mức chính thức</dt><dd>{loan.officialAmount ? moneyText(loan.officialAmount) : 'Chưa xác định'}</dd></div>
            <div><dt>Số tiền đề xuất</dt><dd>{moneyText(loan.proposedAmount)}</dd></div>
            <div><dt>Thời hạn</dt><dd>{loan.loanTermMonths} tháng</dd></div>
            <div><dt>Loại vay</dt><dd>{loanTypeLabel(loan.loanType)}</dd></div>
            <div><dt>Ngành nghề</dt><dd>{loan.company.industry || '—'}</dd></div>
            <div><dt>Đề xuất / vốn điều lệ</dt><dd>{debtToEquityText(loan)}</dd></div>
            <div><dt>CBTD phụ trách</dt><dd>{loan.assignedUser?.fullName || 'Chưa phân công'}</dd></div>
          </dl>
          {highLeverage && <p className="aw-alert aw-alert-warning">Đòn bẩy cao: đề xuất trên {HIGH_LEVERAGE} lần vốn điều lệ.</p>}
          {overLimit && <p className="aw-alert aw-alert-danger">Vượt hạn mức chi nhánh (tối đa 10 tỷ).</p>}
          <div className="aw-risk">
            <span className="aw-label">Nguy cơ trễ SLA</span>
            <strong>{hasPrediction && prediction ? `${riskLabel(prediction.riskLevel)} · ${(prediction.delayProbability * 100).toFixed(1)}%` : predictionLabel(loan.predictionStatus)}</strong>
            {reasons.length > 0 && <ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
            <p className="aw-hint">Chỉ cảnh báo nguy cơ trễ hạn xử lý, không phải đánh giá tín dụng.</p>
          </div>
        </section>
      </aside>
    </div>
  </div>;
}
