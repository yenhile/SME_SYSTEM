import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { appraisalActions, debtToEquityText, isLoanUuid, loanTypeLabel, moneyText, proposedRateBasis, type AppraisalReportView } from '../appraisalWorkspace';
import { predictionLabel, slaDeadlineCell, slaStateLabel, predictionHeadline } from '../slaDisplay';
import type { PortalFormConfig } from '../portal/model';
import type { LoanApplication } from '../types';
import { AppraisalDecisionPanel, type DecisionSubmit } from './AppraisalDecisionPanel';
import { AppraisalEvidenceTabs } from './AppraisalEvidenceTabs';
import { AppraisalReportCard } from './AppraisalReportCard';
import { JumpToDecision } from './JumpToDecision';
import { DecisionResult } from './DecisionResult';
import { PortalIntakeDetails } from './PortalIntakeDetails';
import { SuccessToast } from './SuccessToast';
import './appraisal-workspace.css';

interface AppraisalWorkspaceProps {
  reference: string;
  onBack: () => void;
  onChanged: () => void;
  onResolved: (applicationCode: string) => void;
  lookup?: boolean;
  onOpenForReview?: (reference: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Bị từ chối',
  CLOSED_TIMEOUT: 'Đã đóng do quá hạn bổ sung',
  PENDING_APPRAISAL: 'Đang thẩm định',
};
const SUCCESS_NOTICES: Record<DecisionSubmit['action'], string> = { approve: 'Đã phê duyệt hồ sơ.', reject: 'Đã từ chối hồ sơ.', clarify: 'Đã gửi yêu cầu làm rõ cho CBTD.' };

function loadErrorMessage(error: unknown): { title: string; detail: string; retry: boolean } {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 403) return { title: 'Bạn không có quyền xem hồ sơ này', detail: 'Thẩm quyền chỉ truy cập hồ sơ từ công đoạn Thẩm định trở đi.', retry: false };
  if (status === 404) return { title: 'Không tìm thấy hồ sơ', detail: 'Hồ sơ không tồn tại hoặc địa chỉ không đúng.', retry: false };
  return { title: 'Không tải được hồ sơ', detail: (error as Error).message, retry: true };
}

export async function resolveLoanId(reference: string): Promise<string> {
  if (isLoanUuid(reference)) return reference;
  const matches = await api.get<LoanApplication[]>(`/loan-applications?keyword=${encodeURIComponent(reference)}`);
  const match = matches.find(loan => loan.applicationCode === reference);
  if (!match) throw new ApiError('Không tìm thấy hồ sơ.', 404);
  return match.id;
}

export function AppraisalWorkspace({ reference, onBack, onChanged, onResolved, lookup = false, onOpenForReview }: AppraisalWorkspaceProps) {
  const { activeRole } = useAuth();
  const [loan, setLoan] = useState<LoanApplication | null>(null);
  const [report, setReport] = useState<AppraisalReportView | null>(null);
  const [config, setConfig] = useState<PortalFormConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [loadError, setLoadError] = useState<ReturnType<typeof loadErrorMessage> | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [predictMessage, setPredictMessage] = useState('');
  const request = useRef(0);
  const decisionRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const current = ++request.current;
    try {
      const id = await resolveLoanId(reference);
      const detail = await api.get<LoanApplication>(`/loan-applications/${id}`);
      const nextReport = detail.businessPolicyVersion ? await api.get<AppraisalReportView | null>(`/appraisals/${id}`) : null;
      if (current !== request.current) return;
      setLoan(detail);
      setReport(nextReport ?? null);
      setLoadError(null);
      onResolved(detail.applicationCode);
      if (detail.portalRequest) {
        try {
          const nextConfig = await api.get<PortalFormConfig>('/portal-intakes/form-config');
          if (current === request.current) { setConfig(nextConfig); setConfigError(''); }
        } catch (err) { if (current === request.current) setConfigError((err as Error).message); }
      }
    } catch (err) {
      if (current === request.current) { setLoan(null); setLoadError(loadErrorMessage(err)); }
    }
  }, [reference, onResolved]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setLoan(null); setReport(null); setLoadError(null); setNotice(''); setActionError('');
    void load();
    return () => { request.current++; };
  }, [load]);

  if (loadError) return <div className="aw-page">
    <button type="button" className="btn btn-secondary aw-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Danh sách</button>
    <section className="card aw-card aw-state" role="alert">
      <h1 className="aw-state-title">{loadError.title}</h1>
      <p>{loadError.detail}</p>
      {loadError.retry && <button type="button" className="btn btn-primary" onClick={() => { setLoadError(null); void load(); }}>Thử lại</button>}
    </section>
  </div>;

  if (!loan) return <div className="aw-page" aria-busy="true">
    <p role="status" className="aw-sr-only">Đang tải hồ sơ…</p>
    <div className="aw-skeleton aw-skeleton-header" />
    <div className="aw-layout"><div className="aw-skeleton aw-skeleton-main" /><div className="aw-skeleton aw-skeleton-side" /></div>
  </div>;

  const actions = appraisalActions(loan, report, activeRole);
  const limit = Number(loan.officialAmount || loan.proposedAmount);
  const rateBasis = proposedRateBasis(report);
  const finished = Boolean(loan.completedAt) || loan.currentStage === 'HOAN_TAT';
  const writeBlocked = Boolean(loan.coordinationRestrictions?.writeBlocked);
  const canEdit = !lookup && activeRole === 'THAM_QUYEN' && loan.currentStage === 'THAM_DINH' && !finished && !writeBlocked;
  const canPredict = !finished && !lookup && ['THAM_QUYEN', 'QUAN_LY'].includes(activeRole ?? '');
  const deadline = slaDeadlineCell(finished ? null : loan.slaSummary);
  const prediction = loan.delayPredictions?.[0];
  const hasPrediction = Boolean(prediction) && loan.predictionStatus !== 'INCOMPATIBLE_PA1';
  let reasons: string[] = [];
  if (hasPrediction && prediction?.topReasonsJson) {
    try { reasons = JSON.parse(prediction.topReasonsJson); } catch { reasons = [prediction.topReasonsJson]; }
  }
  const statusLabel = STATUS_LABELS[loan.currentStatus] ?? slaStateLabel(loan.slaState) ?? 'Đang xử lý';

  const submitDecision = async (decision: DecisionSubmit) => {
    setBusy(true); setActionError(''); setNotice('');
    try {
      if (decision.action === 'clarify') {
        await api.post(`/appraisals/${loan.id}/clarify`, { expectedRevision: report?.revision ?? 0, clientRequestId: crypto.randomUUID(), message: decision.message });
      } else if (decision.action === 'approve') {
        await api.post(`/workflow/${loan.id}/transition`, {
          targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: actions.versionId,
          approvedAmount: decision.approvedAmount, interestRate: decision.interestRate, interestRateReason: decision.interestRateReason,
          notes: `Phê duyệt cấp tín dụng: ${decision.approvedAmount.toLocaleString('vi-VN')} VNĐ, Lãi suất: ${decision.interestRate}%/năm`,
        });
      } else {
        await api.post(`/workflow/${loan.id}/transition`, {
          targetStage: 'HOAN_TAT', targetStatus: 'REJECTED', reportVersionId: actions.versionId,
          rejectionReasonCode: decision.rejectionReasonCode, rejectionNote: decision.rejectionNote,
          notes: `Từ chối khoản vay theo danh mục ${decision.rejectionReasonCode}: ${decision.rejectionNote}`,
        });
      }
      setNotice(SUCCESS_NOTICES[decision.action]);
      await load();
      onChanged();
    } catch (err) {
      setActionError((err as Error).message);
      await load();
    } finally { setBusy(false); }
  };

  const rePredict = async () => {
    setBusy(true); setPredictMessage('');
    try {
      const result = await api.post<{ unavailable?: boolean; message?: string }>(`/prediction/predict/${loan.id}`);
      if (result?.unavailable) setPredictMessage(result.message || predictionLabel('NONE'));
      await load();
    } catch (err) { setPredictMessage((err as Error).message); }
    finally { setBusy(false); }
  };

  return <div className="aw-page">
    <header className="aw-header">
      <button type="button" className="btn btn-secondary aw-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Danh sách</button>
      <div className="aw-header-main">
        <div className="aw-header-title">
          <h1>{loan.applicationCode}</h1>
          <span className={`badge ${loan.currentStatus === 'APPROVED' ? 'badge-soft-green' : loan.currentStatus === 'REJECTED' ? 'badge-soft-red' : 'badge-soft-amber'}`}>{statusLabel}</span>
          {!loan.businessPolicyVersion && <span className="badge badge-soft-gray">Quy trình cũ</span>}
          {loan.source === 'QUAY' && <span className="badge badge-soft-gray">Tạo tại quầy</span>}
          {loan.source === 'PORTAL' && <span className="badge badge-soft-gray">Từ Portal</span>}
        </div>
        <p>{loan.company.companyName} · MST {loan.company.taxCode}</p>
      </div>
      {!finished && <div className={`aw-header-deadline aw-tone-${deadline.tone}`}>
        <span className="aw-label">Hạn SLA</span>
        <strong>{deadline.text}</strong>
        {deadline.detail && <span>{deadline.detail}</span>}
      </div>}
      <button type="button" className="btn btn-secondary aw-refresh" disabled={busy} onClick={() => void load()} aria-label="Tải lại hồ sơ"><RefreshCw size={16} aria-hidden="true" /></button>
    </header>

    <SuccessToast message={notice} onClose={() => setNotice('')} />

    <div className="aw-layout">
      <div className="aw-main">
        <AppraisalReportCard key={report?.versions[0]?.id ?? 'empty'} loan={loan} report={report} finished={finished} />

        {loan.portalRequest?.formVersion === 2 && <details className="card aw-card portal-intake">
          <summary>Đề nghị gốc từ cổng doanh nghiệp · {loan.portalRequest.reference}</summary>
          {configError && <p role="alert" className="aw-alert aw-alert-danger">Không tải được danh mục tài liệu: {configError}</p>}
          <PortalIntakeDetails request={loan.portalRequest} config={config} busy={busy} />
        </details>}

        <AppraisalEvidenceTabs loan={loan} canEdit={canEdit} config={config} onChanged={() => { void load(); onChanged(); }} />
      </div>

      <aside className="aw-side">
        <section className="card aw-card aw-info" aria-label="Thông tin khoản vay">
          <h2 className="aw-card-title">Khoản vay</h2>
          <dl className="aw-facts">
            <div className="aw-fact-strong"><dt>Hạn mức chính thức</dt><dd>{moneyText(loan.officialAmount)}</dd></div>
            <div><dt>Số tiền đề xuất</dt><dd>{moneyText(loan.proposedAmount)}</dd></div>
            <div><dt>Thời hạn</dt><dd>{loan.loanTermMonths} tháng</dd></div>
            <div><dt>Loại vay</dt><dd>{loanTypeLabel(loan.loanType)}</dd></div>
            <div><dt>Ngành nghề</dt><dd>{loan.company.industry || '—'}</dd></div>
            <div><dt>Đề xuất / vốn điều lệ</dt><dd>{debtToEquityText(loan)}</dd></div>
            <div><dt>CBTD phụ trách</dt><dd>{loan.assignedUser?.fullName || 'Chưa phân công'}</dd></div>
          </dl>
          <div className="aw-risk">
            <div className="aw-risk-heading">
              <span className="aw-label">Nguy cơ trễ SLA</span>
              {canPredict && <button type="button" className="aw-link" disabled={busy} onClick={() => void rePredict()}>Chạy lại</button>}
            </div>
            <strong>{hasPrediction && prediction ? predictionHeadline(prediction) : predictionLabel(loan.predictionStatus)}</strong>
            {reasons.length > 0 && <ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
            {predictMessage && <p className="aw-hint">{predictMessage}</p>}
            <p className="aw-hint">Chỉ cảnh báo nguy cơ trễ hạn xử lý, không phải đánh giá tín dụng.</p>
          </div>
        </section>
        <div className="aw-decision" ref={decisionRef} tabIndex={-1}>
          {finished
            ? <DecisionResult loan={loan} />
            : lookup ? <section className="card aw-card" aria-label="Chế độ tra cứu">
              <h2 className="aw-card-title">Chỉ xem</h2>
              <p className="aw-hint">Bạn đang tra cứu từ Danh sách hồ sơ nên không có thao tác trên hồ sơ này.</p>
              <button type="button" className="btn btn-secondary aw-submit" onClick={() => onOpenForReview?.(reference)}>Mở tại Thẩm định &amp; phê duyệt</button>
            </section>
            : <AppraisalDecisionPanel key={`${loan.id}:${actions.versionId ?? ''}:${report?.status ?? ''}`} actions={actions} limit={limit} busy={busy} error={actionError} clarifyBlockReason={report?.makerChecker?.clarifyBlockReason} proposedRate={rateBasis.rate} proposedRateNote={rateBasis.note} proposalMissing={rateBasis.blocksApproval} band={loan.rateBand} onSubmit={decision => void submitDecision(decision)} />}
        </div>
      </aside>
    </div>
    {!finished && !lookup && <JumpToDecision target={decisionRef} />}
  </div>;
}
