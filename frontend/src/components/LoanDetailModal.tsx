import { AppraisalPanel } from './AppraisalPanel';
import { DecisionResult } from './DecisionResult';
import { documentFormat, documentTypeName, officialAmountError } from './loanInputRules';
import { documentTypeLabel, riskLabel } from '../appraisalWorkspace';
import { loanStatusView, stageLabel } from '../loanListDisplay';
import {AssignmentChangeRequestPanel} from './AssignmentChangeRequestPanel';
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { predictionLabel, slaPolicyLabel, slaStateLabel, slaSummaryText, stageDurationText, stageStandardText } from '../slaDisplay';
import { PortalIntakeDetails } from './PortalIntakeDetails';
import { SupplementPanel } from './SupplementPanel';
import { SupplementDeadlineBadge } from './SupplementDeadlineBadge';
import { CloseOverdueForm } from './CloseOverdueForm';
import { canCloseOverdue } from './closeOverdue';
import { extractAcceptedSupplementFiles } from '../portal/supplements';
import type { PortalFormConfig } from '../portal/model';
import {
  LoanApplication,
  StageCode,
  DocumentType,
} from '../types';
import {
  X,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileCheck,
  Send,
  PauseCircle,
  PlayCircle,
  Check,
  FileText,
  Building,
  BrainCircuit,
  Plus,
  Trash2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface LoanDetailModalProps {
  applicationId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  initialLoan?: LoanApplication | null;
  initialTab?: 'timeline' | 'documents' | 'supplements';
}

export const LoanDetailModal: React.FC<LoanDetailModalProps> = ({
  applicationId,
  onClose,
  onRefresh,
  initialLoan = null,
  initialTab = 'timeline',
}) => {
  const { activeRole, user } = useAuth();
  const [reportVersionId,setReportVersionId]=useState<string|undefined>();
  const [loan, setLoan] = useState<LoanApplication | null>(initialLoan);
  const [portalConfig, setPortalConfig] = useState<PortalFormConfig | null>(null);
  const [portalConfigError, setPortalConfigError] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'documents' | 'supplements'>(initialTab);

  // Form states cho bổ sung hồ sơ
  const [supplementContent, setSupplementContent] = useState('');
  const [showSupplementForm, setShowSupplementForm] = useState(false);

  // Form states cho duyệt/từ chối
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [approvedInterestRate, setApprovedInterestRate] = useState('');

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [rejectionReasonCode, setRejectionReasonCode] = useState('TC02');
  const [rejectionNote, setRejectionNote] = useState('');

  // Form state cho upload document
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('PHAP_LY');
  const [docFile, setDocFile] = useState<File | null>(null);

  // Form xác định hạn mức vay chính thức
  const [showSetAmountForm, setShowSetAmountForm] = useState(false);
  const [officialAmountInput, setOfficialAmountInput] = useState<number>(0);

  const fetchDetail = async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const data = await api.get<LoanApplication>(`/loan-applications/${applicationId}`);
      setLoan(data);
      setPortalConfig(null); setPortalConfigError('');
      if (data.portalRequest) {
        try { setPortalConfig(await api.get<PortalFormConfig>('/portal-intakes/form-config')); }
        catch (err) { setPortalConfigError((err as Error).message); }
      }
      setApprovedAmount(Number(data.officialAmount || data.proposedAmount));
      setOfficialAmountInput(Number(data.officialAmount || data.proposedAmount));
    } catch (err: any) {
      alert(`Không thể tải chi tiết hồ sơ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialLoan) {
      setLoan(initialLoan);
      setApprovedAmount(Number(initialLoan.officialAmount || initialLoan.proposedAmount));
      setOfficialAmountInput(Number(initialLoan.officialAmount || initialLoan.proposedAmount));
    } else {
      fetchDetail();
    }
  }, [applicationId, initialLoan]);

  const acceptedSupplementFiles = useMemo(
    () => extractAcceptedSupplementFiles(loan?.supplementRequests),
    [loan?.supplementRequests]
  );

  if (!applicationId || !loan) return null;

  // 1. Chuyển sang Thẩm định (CBTD -> THAM_DINH)
  const handleTransitionToAppraisal = async () => {
    if (!window.confirm('Chuyển hồ sơ sang giai đoạn Thẩm định tín dụng? Hệ thống AI sẽ tự động đánh giá nguy cơ trễ hạn.')) return;
    setActionLoading(true);
    try {
      await api.post(`/workflow/${loan.id}/transition`, {
        targetStage: 'THAM_DINH',
        targetStatus: 'PENDING_APPRAISAL',
        notes: 'Chuyển sang công đoạn thẩm định hồ sơ',
      });
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Phê duyệt khoản vay
  const interestRateEntered = approvedInterestRate.trim() !== '';
  const interestRateValid = interestRateEntered && Number(approvedInterestRate) >= 0 && Number(approvedInterestRate) <= 100;
  const handleApprove = async () => {
    if (isMakerCheckerDecisionBlocked) {
      alert(loan.makerCheckerRestrictions?.decisionBlockReason || 'Bạn không đủ điều kiện độc lập để ra quyết định tín dụng.');
      return;
    }
    const maxLimit = Number(loan.officialAmount || loan.proposedAmount);
    if (!Number.isFinite(approvedAmount) || Number(approvedAmount) <= 0 || Number(approvedAmount) > maxLimit) {
      alert(`Số tiền phê duyệt phải lớn hơn 0 và không vượt quá hạn mức ${maxLimit.toLocaleString('vi-VN')} VNĐ.`);
      return;
    }
    if (!interestRateValid) {
      alert('Lãi suất phê duyệt phải từ 0% đến 100%/năm.');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/workflow/${loan.id}/transition`, {
        targetStage: 'HOAN_TAT',
        targetStatus: 'APPROVED',
        reportVersionId,
        approvedAmount: Number(approvedAmount),
        interestRate: Number(approvedInterestRate),
        notes: `Phê duyệt cấp tín dụng: ${Number(approvedAmount).toLocaleString('vi-VN')} VNĐ, Lãi suất: ${approvedInterestRate}%/năm`,
      });
      setShowApproveForm(false);
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Quản lý đóng thủ công hồ sơ quá hạn bổ sung (DEC-02 / TK-08)
  const handleCloseOverdue = async (reason: string) => {
    if (isMakerCheckerCloseBlocked) {
      alert(loan.makerCheckerRestrictions?.closeOverdueBlockReason || 'Bạn không đủ điều kiện độc lập để đóng hồ sơ quá hạn.');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/workflow/${loan.id}/close-overdue`, { reason });
      setShowCloseForm(false);
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Từ chối khoản vay
  const handleReject = async () => {
    if (isMakerCheckerDecisionBlocked) {
      alert(loan.makerCheckerRestrictions?.decisionBlockReason || 'Bạn không đủ điều kiện độc lập để ra quyết định tín dụng.');
      return;
    }
    if (!rejectionNote.trim()) {
      alert('Vui lòng nhập lý do giải thích từ chối');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/workflow/${loan.id}/transition`, {
        targetStage: 'HOAN_TAT',
        targetStatus: 'REJECTED',
        reportVersionId,
        rejectionReasonCode,
        rejectionNote,
        notes: `Từ chối khoản vay theo danh mục ${rejectionReasonCode}: ${rejectionNote}`,
      });
      setShowRejectForm(false);
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Xác nhận hạn mức chính thức
  const handleSetOfficialAmount = async () => {
    if (officialAmountError(officialAmountInput, loan.proposedAmount)) return;
    setActionLoading(true);
    try {
      await api.put(`/loan-applications/${loan.id}/set-amount`, {
        officialAmount: Number(officialAmountInput),
      });
      setShowSetAmountForm(false);
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Gửi yêu cầu bổ sung chứng từ (tạm dừng SLA)
  const handleCreateSupplement = async () => {
    if (!supplementContent.trim()) {
      alert('Vui lòng nhập nội dung chứng từ cần bổ sung');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/supplements/${loan.id}`, {
        requestContent: supplementContent,
      });
      setSupplementContent('');
      setShowSupplementForm(false);
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Giải quyết yêu cầu bổ sung (kích hoạt lại SLA)
  const handleResolveSupplement = async (suppId: string) => {
    setActionLoading(true);
    try {
      await api.put(`/supplements/${suppId}/resolve`, {
        notes: 'Doanh nghiệp đã nộp đủ chứng từ bổ sung',
      });
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Chạy lại dự báo AI thủ công
  const handleRePredict = async () => {
    setActionLoading(true);
    try {
      const result = await api.post<{ unavailable?: boolean; message?: string }>(`/prediction/predict/${loan.id}`);
      if (result?.unavailable) alert(result.message || predictionLabel('INCOMPATIBLE_PA1'));
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi cập nhật AI: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 9. Thêm chứng từ
  const handleAddDocument = async () => {
    if (!docFile) {
      alert('Vui lòng chọn tệp tài liệu (tối đa 10 MB)');
      return;
    }
    setActionLoading(true);
    try {
      const form = new FormData();
      form.append('documentType', docType);
      form.append('file', docFile);
      await api.post(`/documents/${loan.id}`, form);
      setDocFile(null);
      setShowDocForm(false);
      await fetchDetail();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 10. Xóa chứng từ
  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Xóa tài liệu này khỏi hồ sơ?')) return;
    try {
      await api.delete(`/documents/${docId}`);
      await fetchDetail();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  // 11. Đánh dấu đầy đủ chứng từ
  const handleToggleDocComplete = async () => {
    setActionLoading(true);
    try {
      await api.put(`/loan-applications/${loan.id}/check-documents`, {
        isComplete: !loan.isDocumentComplete,
      });
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const terminal = loan.currentStage === 'HOAN_TAT' || ['APPROVED', 'REJECTED', 'CLOSED_TIMEOUT'].includes(loan.currentStatus);
  const writeBlocked=loan.coordinationRestrictions?.writeBlocked??false;
  const decisionBlocked=loan.coordinationRestrictions?.decisionBlocked??false;
  const isMakerCheckerDecisionBlocked = Boolean(loan.makerCheckerRestrictions?.decisionBlocked);
  const isMakerCheckerCloseBlocked = loan.makerCheckerRestrictions?.canCloseOverdue === false;
  const isAssignedOfficer = !loan.assignedTo || loan.assignedTo === user?.id;
  const reception = activeRole === 'CBTD' && isAssignedOfficer && loan.currentStage === 'TIEP_NHAN' && !terminal&&!writeBlocked;
  const appraisal = activeRole === 'THAM_QUYEN' && loan.currentStage === 'THAM_DINH' && !terminal&&!writeBlocked;
  const canEdit = reception || appraisal;
  const waitingSupplement = loan.currentStatus === 'SUPPLEMENT_REQUIRED';
  const showDocCheckReminder =
    activeRole === 'CBTD' &&
    loan.assignedTo === user?.id &&
    loan.currentStage === 'TIEP_NHAN' &&
    !terminal &&
    !writeBlocked &&
    !waitingSupplement &&
    !loan.isDocumentComplete &&
    loan.currentStatus !== 'CHECKED';

  const totalUnifiedDocuments = (loan.documents?.length || 0) + acceptedSupplementFiles.length;
  const evidenceKey = JSON.stringify([(loan.documents ?? []).map(doc => doc.id), (loan.supplementRequests ?? []).map(request => [request.id, request.status, request.resolvedAt, request.portalSupplement?.revision])]);
  const canPredict = !terminal && ['THAM_QUYEN', 'QUAN_LY'].includes(activeRole || '');
  const latestPrediction = loan.delayPredictions?.[0];
  let topReasons: string[] = [];
  if (latestPrediction?.topReasonsJson) {
    try {
      topReasons = JSON.parse(latestPrediction.topReasonsJson);
    } catch {
      topReasons = [latestPrediction.topReasonsJson];
    }
  }

  const stageSla = (code:StageCode) => { const history=[...(loan.stageHistories??[])].reverse().find(h=>h.stage?.stageCode===code); return !history&&code!=='HOAN_TAT'?'Theo cấu hình':stageStandardText(code,history?.slaStandardHours,history?.slaPolicy??null); };
  const formatVnd = (num?: number | string | null) => {
    if (!num) return '0 VNĐ';
    return `${Number(num).toLocaleString('vi-VN')} VNĐ`;
  };

  // Tính toán chỉ số tài chính cảnh báo rủi ro (Risk Alert)
  const debtToEquity =
    Number(loan.company.charterCapital) > 0
      ? (Number(loan.proposedAmount) / Number(loan.company.charterCapital)).toFixed(2)
      : 'N/A';
  const isHighLeverage = Number(debtToEquity) > 2.0;
  const isExceedBranchLimit = Number(loan.officialAmount || loan.proposedAmount) > 10000000000;

  // Xác định bước tiến trình (Progress step)
  const getStepIndex = (st: StageCode) => {
    if (st === 'TIEP_NHAN') return 1;
    if (st === 'THAM_DINH') return 2;
    return 3;
  };
  const currentStepIdx = getStepIndex(loan.currentStage);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '980px' }}>
        {/* Header Modal Trắng Sáng */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {loan.applicationCode}
                </h3>
                {!loan.businessPolicyVersion && <span className="badge badge-soft-gray" title="Giữ quy trình và lịch sử trước cập nhật; không tạo tờ trình hồi tố">Hồ sơ theo quy trình cũ</span>}
                {loan.source === 'QUAY' && <span className="badge badge-soft-gray" title="Hồ sơ do CBTD tạo trực tiếp, không qua vòng kiểm tra Portal">Tạo tại quầy</span>}
                {loan.currentStatus === 'APPROVED' ? (
                  <span className="badge badge-soft-green">Đã phê duyệt</span>
                ) : loan.currentStatus === 'REJECTED' ? (
                  <span className="badge badge-soft-red">Bị từ chối</span>
                ) : loan.currentStatus === 'CLOSED_TIMEOUT' ? (
                  <span className="badge badge-soft-gray">Đã đóng (quá hạn bổ sung)</span>
                ) : loan.currentStatus === 'SUPPLEMENT_REQUIRED' ? (
                  <span className="badge badge-soft-orange">{slaStateLabel(loan.slaState) ?? 'Chờ bổ sung (Tạm dừng SLA)'}</span>
                ) : loan.currentStatus === 'PENDING_APPRAISAL' ? (
                  <span className="badge badge-soft-amber">Đang thẩm định</span>
                ) : (
                  <span className="badge badge-soft-blue">Đang xử lý</span>
                )}
                {loan.supplementCount > 0 && (
                  <span className="badge badge-soft-orange">Đã bổ sung {loan.supplementCount} lần</span>
                )}
                {loan.currentStatus === 'SUPPLEMENT_REQUIRED' && <SupplementDeadlineBadge requests={loan.supplementRequests} />}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {loan.company.companyName} • MST: {loan.company.taxCode}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body Modal */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DecisionResult loan={loan} />
          {loan.businessPolicyVersion && <AppraisalPanel loan={loan} evidenceKey={evidenceKey} onVersion={setReportVersionId} onChanged={()=>{void fetchDetail();onRefresh();}} />}
          {writeBlocked&&<p role="alert" className="portal-error">Bạn đang chờ giải quyết xung đột lợi ích; các thao tác ghi nghiệp vụ trên hồ sơ này bị chặn.</p>}
          {decisionBlocked&&<p role="alert" className="portal-error">Chưa được chốt quyết định tín dụng khi xung đột lợi ích còn chờ giải quyết.</p>}
          {activeRole === 'THAM_QUYEN' && isMakerCheckerDecisionBlocked && (
            <p role="alert" className="portal-error">
              {loan.makerCheckerRestrictions?.decisionBlockReason || 'Bạn không đủ điều kiện độc lập để ra quyết định tín dụng trên hồ sơ này (Maker-Checker).'}
            </p>
          )}
          {activeRole === 'QUAN_LY' && loan.currentStatus === 'SUPPLEMENT_REQUIRED' && isMakerCheckerCloseBlocked && (
            <p role="alert" className="portal-error">
              {loan.makerCheckerRestrictions?.closeOverdueBlockReason || 'Bạn không đủ điều kiện độc lập để đóng hồ sơ quá hạn (Maker-Checker).'}
            </p>
          )}
          <AssignmentChangeRequestPanel key={'coordination:'+loan.id} subject={{type:'LOAN',id:loan.id,assignmentVersion:loan.assignmentVersion,ownerId:loan.assignedTo,closed:terminal}} onChanged={async()=>{await fetchDetail();onRefresh();}}/>
          {!!loan.assignments?.length&&<details className="coordination-history portal-card"><summary>Lịch sử bàn giao hồ sơ ({loan.assignments.length})</summary><p>CBTD hiện tại: {loan.assignedUser?.fullName||loan.assignedUser?.username||'Chưa phân công'}</p><ol>{loan.assignments.map(entry=><li key={entry.id}><strong>{entry.fromUser?.fullName||'Chưa phân công'} → {entry.toUser?.fullName||entry.toUser.username}</strong><p>{new Date(entry.reassignedAt).toLocaleString('vi-VN')} · Quản lý: {entry.manager?.fullName||entry.manager.username}</p><p>Lý do: {entry.reason}</p></li>)}</ol></details>}
          {loan.portalRequest?.formVersion === 2 && <details className="portal-intake portal-card"><summary>Đề nghị gốc từ cổng doanh nghiệp · {loan.portalRequest.reference}</summary>{portalConfigError && <p className="portal-error" role="alert">Không tải được danh mục tài liệu: {portalConfigError}</p>}<PortalIntakeDetails request={loan.portalRequest} config={portalConfig} busy={actionLoading} /></details>}
          {/* C. THANH TIẾN TRÌNH QUY TRÌNH (WORKFLOW PROGRESS BAR) TRÊN CÙNG MÀN HÌNH */}
          <div className="workflow-progress-bar" data-business-policy={loan.businessPolicyVersion??'legacy'}>
            <div className={`progress-step ${currentStepIdx >= 1 ? (currentStepIdx === 1 ? 'active' : 'completed') : ''}`}>
              <div className="progress-step-circle">{currentStepIdx > 1 ? '✓' : '1'}</div>
              <div className="progress-step-text">
                <h4>Tiếp nhận</h4>
                <p>SLA: {stageSla('TIEP_NHAN')}</p>
              </div>
            </div>

            <div className={`progress-step-line ${currentStepIdx > 1 ? 'completed' : ''}`} />

            <div className={`progress-step ${currentStepIdx >= 2 ? (currentStepIdx === 2 ? 'active' : 'completed') : ''}`}>
              <div className="progress-step-circle">{currentStepIdx > 2 ? '✓' : '2'}</div>
              <div className="progress-step-text">
                <h4>Thẩm định</h4>
                <p>SLA: {stageSla('THAM_DINH')}</p>
              </div>
            </div>

            <div className={`progress-step-line ${currentStepIdx > 2 ? 'completed' : ''}`} />

            <div className={`progress-step ${currentStepIdx === 3 ? 'completed' : ''}`}>
              <div className="progress-step-circle">{currentStepIdx === 3 ? '✓' : '3'}</div>
              <div className="progress-step-text">
                <h4>Hoàn tất quyết định</h4>
                <p>SLA: {stageSla('HOAN_TAT')}</p>
              </div>
            </div>
          </div>

          {/* D4-02: Hướng dẫn CBTD phụ trách rà soát & xác nhận đủ chứng từ tại Tiếp nhận */}
          {showDocCheckReminder && (
            <div
              style={{
                background: 'var(--badge-amber-bg)',
                border: '1px solid var(--badge-amber-border)',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={20} color="#b45309" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--badge-amber-text)' }}>
                    Hồ sơ tại công đoạn Tiếp nhận — Cần kiểm tra và xác nhận danh mục chứng từ
                  </div>
                  <div style={{ fontSize: '12px', color: '#92400e', marginTop: 2 }}>
                    Vui lòng rà soát tài liệu nộp ban đầu và tệp bổ sung tại tab "Danh mục chứng từ", sau đó bấm "Xác nhận hồ sơ đầy đủ" để hoàn tất công đoạn tiếp nhận trước khi chuyển thẩm định.
                  </div>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ background: '#ffffff', whiteSpace: 'nowrap', fontSize: '12px' }}
                onClick={() => setActiveTab('documents')}
              >
                Xem chứng từ
              </button>
            </div>
          )}

          {/* Card AI Dự báo nguy cơ trễ hạn (Machine Learning Highlight) - Phong cách Pastel */}
          <div
            className="card"
            style={{
              background:
                latestPrediction?.riskLevel === 'CAO'
                  ? 'var(--badge-red-bg)'
                  : latestPrediction?.riskLevel === 'TRUNG_BINH'
                  ? 'var(--badge-amber-bg)'
                  : 'var(--badge-green-bg)',
              borderColor:
                latestPrediction?.riskLevel === 'CAO'
                  ? 'var(--badge-red-border)'
                  : latestPrediction?.riskLevel === 'TRUNG_BINH'
                  ? 'var(--badge-amber-border)'
                  : 'var(--badge-green-border)',
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BrainCircuit
                  size={20}
                  color={
                    latestPrediction?.riskLevel === 'CAO'
                      ? '#991b1b'
                      : latestPrediction?.riskLevel === 'TRUNG_BINH'
                      ? '#92400e'
                      : '#065f46'
                  }
                />
                <h4 style={{ fontSize: '14px', fontWeight: 600 }}>
                  Dự báo nguy cơ trễ hạn SLA
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={`badge ${
                    latestPrediction?.riskLevel === 'CAO'
                      ? 'badge-soft-red'
                      : latestPrediction?.riskLevel === 'TRUNG_BINH'
                      ? 'badge-soft-amber'
                      : 'badge-soft-green'
                  }`}
                  style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 600 }}
                >
                  Nguy cơ trễ SLA: {latestPrediction && loan.predictionStatus !== 'INCOMPATIBLE_PA1' ? riskLabel(latestPrediction.riskLevel) : loan.predictionStatus === 'INCOMPATIBLE_PA1' ? predictionLabel(loan.predictionStatus) : 'Chưa đánh giá'}
                </span>
                {canPredict && <button
                  onClick={handleRePredict}
                  disabled={actionLoading}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px', background: '#ffffff' }}
                >
                  Chạy lại AI
                </button>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 16, alignItems: 'center' }}>
              <div style={{ borderRight: '1px solid rgba(0,0,0,0.08)', paddingRight: 16 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Xác suất trễ hạn (SLA)</div>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color:
                      latestPrediction?.riskLevel === 'CAO'
                        ? '#991b1b'
                        : latestPrediction?.riskLevel === 'TRUNG_BINH'
                        ? '#92400e'
                        : '#065f46',
                  }}
                >
                  {latestPrediction && loan.predictionStatus !== 'INCOMPATIBLE_PA1' ? `${(latestPrediction.delayProbability * 100).toFixed(1)}%` : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Các yếu tố chính ảnh hưởng đến nguy cơ trễ hạn:
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {topReasons.length > 0 ? (
                    topReasons.map((reason, idx) => (
                      <li
                        key={idx}
                        style={{
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          color: 'var(--text-secondary)',
                          marginBottom: 3,
                        }}
                      >
                        <span style={{ color: '#ea580c', fontWeight: 600 }}>•</span>
                        {reason}
                      </li>
                    ))
                  ) : (
                    <li style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Chưa ghi nhận yếu tố rủi ro bất thường.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* B. Khối Thông tin hồ sơ & CẢNH BÁO RỦI RO TÀI CHÍNH (RISK ALERTS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {/* Thẻ Đề xuất vay */}
            <div className="card" style={{ padding: '14px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Số tiền đề xuất</span>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--primary-hover)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {formatVnd(loan.proposedAmount)}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Thời hạn: {loan.loanTermMonths} tháng
              </span>
            </div>

            {/* Thẻ Hạn mức chính thức */}
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Hạn mức chính thức</span>
                {reception && !waitingSupplement && <button
                  onClick={() => setShowSetAmountForm(!showSetAmountForm)}
                  style={{ background: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: 600, padding: 0 }}
                >
                  Sửa
                </button>}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {loan.officialAmount ? formatVnd(loan.officialAmount) : 'Chưa định mức'}
              </div>
              {isExceedBranchLimit ? (
                <div className="risk-alert-inline danger">
                  <AlertCircle size={12} /> Vượt hạn mức chi nhánh (tối đa 10 tỷ)
                </div>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--badge-green-text)' }}>≤ 10 tỷ (Duyệt tại chi nhánh)</span>
              )}
            </div>

            {/* Thẻ Tỷ lệ Đòn bẩy Nợ/Vốn (Risk Alert) */}
            <div className="card" style={{ padding: '14px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Tỷ lệ nợ / vốn (D/E)</span>
              <div style={{ fontSize: '16px', fontWeight: 600, color: isHighLeverage ? '#dc2626' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {debtToEquity} lần
              </div>
              {isHighLeverage ? (
                <div className="risk-alert-inline danger">
                  <AlertTriangle size={12} /> Đòn bẩy cao (&gt; 2.0)
                </div>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--badge-green-text)' }}>Mức đòn bẩy an toàn</span>
              )}
            </div>

            {/* Thẻ Cán bộ phụ trách */}
            <div className="card" style={{ padding: '14px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Cán bộ phụ trách</span>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {loan.assignedUser?.fullName || 'Chưa gán'}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                @{loan.assignedUser?.username}
              </span>
            </div>
          </div>

          {/* Form sửa hạn mức chính thức */}
          {showSetAmountForm && reception && !waitingSupplement && (
            <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Hạn mức tín dụng phê duyệt chính thức (VNĐ):
                </label>
                <input
                  type="number"
                  step="100000000"
                  value={officialAmountInput}
                  onChange={(e) => setOfficialAmountInput(Number(e.target.value))}
                  style={{ width: '100%', marginTop: 4 }}
                />
                {officialAmountError(officialAmountInput, loan.proposedAmount) && (
                  <p role="alert" style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0' }}>
                    {officialAmountError(officialAmountInput, loan.proposedAmount)}
                  </p>
                )}
              </div>
              <button
                onClick={handleSetOfficialAmount}
                disabled={actionLoading || Boolean(officialAmountError(officialAmountInput, loan.proposedAmount))}
                className="btn btn-primary"
                style={{ marginTop: 18 }}
              >
                Lưu hạn mức
              </button>
            </div>
          )}

          {/* Form Phê duyệt */}
          {showApproveForm && (
            <div style={{ background: 'var(--badge-green-bg)', padding: '16px', borderRadius: 8, border: '1px solid var(--badge-green-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ color: 'var(--badge-green-text)', fontSize: '14px', fontWeight: 600 }}>
                Xác nhận Phê duyệt Cấp tín dụng
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Số tiền phê duyệt (VNĐ):</label>
                  <input
                    type="number"
                    min={1}
                    max={Number(loan.officialAmount || loan.proposedAmount)}
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(Number(e.target.value))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                  {approvedAmount > Number(loan.officialAmount || loan.proposedAmount) && (
                    <p style={{ color: '#dc2626', fontSize: '12px', marginTop: 4, margin: 0 }}>
                      Vượt hạn mức tối đa ({Number(loan.officialAmount || loan.proposedAmount).toLocaleString('vi-VN')} VNĐ).
                    </p>
                  )}
                  {approvedAmount <= 0 && (
                    <p style={{ color: '#dc2626', fontSize: '12px', marginTop: 4, margin: 0 }}>
                      Số tiền phê duyệt phải lớn hơn 0.
                    </p>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Lãi suất phê duyệt (%/năm):</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    required
                    placeholder="Nhập lãi suất"
                    value={approvedInterestRate}
                    onChange={(e) => setApprovedInterestRate(e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                  {interestRateEntered && !interestRateValid && (
                    <p style={{ color: '#dc2626', fontSize: '12px', marginTop: 4, margin: 0 }}>
                      Lãi suất phải từ 0% đến 100%.
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowApproveForm(false)} className="btn btn-secondary">Hủy</button>
                <button
                  onClick={handleApprove}
                  disabled={
                    actionLoading ||
                    isMakerCheckerDecisionBlocked ||
                    approvedAmount <= 0 ||
                    approvedAmount > Number(loan.officialAmount || loan.proposedAmount) ||
                    !interestRateValid
                  }
                  className="btn btn-success"
                >
                  Xác nhận Phê duyệt
                </button>
              </div>
            </div>
          )}

          {showCloseForm && canCloseOverdue(loan, activeRole) && !isMakerCheckerCloseBlocked && (
            <CloseOverdueForm applicationCode={loan.applicationCode} busy={actionLoading} onSubmit={reason => void handleCloseOverdue(reason)} onCancel={() => setShowCloseForm(false)} />
          )}

          {/* Form Từ chối */}
          {showRejectForm && (
            <div style={{ background: 'var(--badge-red-bg)', padding: '16px', borderRadius: 8, border: '1px solid var(--badge-red-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ color: 'var(--badge-red-text)', fontSize: '14px', fontWeight: 600 }}>
                Từ chối Khoản vay (Danh mục TC01 - TC05)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Mã lý do từ chối:</label>
                  <select
                    value={rejectionReasonCode}
                    onChange={(e) => setRejectionReasonCode(e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    <option value="TC01">TC01 - Hồ sơ pháp lý không hợp lệ</option>
                    <option value="TC02">TC02 - Năng lực tài chính không đảm bảo</option>
                    <option value="TC03">TC03 - Phương án kinh doanh không khả thi</option>
                    <option value="TC04">TC04 - Tài sản bảo đảm không đủ điều kiện</option>
                    <option value="TC05">TC05 - Quá hạn thời gian bổ sung chứng từ</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ghi chú giải trình chi tiết:</label>
                  <input
                    type="text"
                    placeholder="Nhập lý do chi tiết..."
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowRejectForm(false)} className="btn btn-secondary">Hủy</button>
                <button onClick={handleReject} disabled={actionLoading || isMakerCheckerDecisionBlocked} className="btn btn-danger">
                  Xác nhận Từ chối hồ sơ
                </button>
              </div>
            </div>
          )}

          {/* Tabs chuyển đổi giữa Timeline, Chứng từ và Bổ sung */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: 16 }}>
            <button
              onClick={() => setActiveTab('timeline')}
              style={{
                background: 'none',
                padding: '8px 12px',
                borderBottom: activeTab === 'timeline' ? '2px solid var(--primary)' : 'none',
                color: activeTab === 'timeline' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              Tiến trình công đoạn SLA ({loan.stageHistories?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              style={{
                background: 'none',
                padding: '8px 12px',
                borderBottom: activeTab === 'documents' ? '2px solid var(--primary)' : 'none',
                color: activeTab === 'documents' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              Danh mục chứng từ ({totalUnifiedDocuments})
            </button>
            <button
              onClick={() => setActiveTab('supplements')}
              style={{
                background: 'none',
                padding: '8px 12px',
                borderBottom: activeTab === 'supplements' ? '2px solid var(--primary)' : 'none',
                color: activeTab === 'supplements' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              Yêu cầu bổ sung ({loan.supplementRequests?.length || 0})
            </button>
          </div>

          {/* Tab 1: Timeline Công đoạn SLA */}
          {activeTab === 'timeline' && (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Công đoạn</th>
                    <th>Cách tính</th>
                    <th>Bắt đầu</th>
                    <th>Kết thúc</th>
                    <th>Thực tế</th>
                    <th>Tạm dừng SLA</th>
                    <th>Thời gian tính SLA</th>
                    <th>SLA chuẩn</th>
                    <th>Trạng thái SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.stageHistories && loan.stageHistories.length > 0 ? (
                    loan.stageHistories.map((h, i) => {
                      // Công đoạn PA1 đang mở: lấy số giờ tính tại thời điểm xem (giờ làm việc), vì chưa có số liệu đóng công đoạn.
                      const live = loan.liveSla && loan.liveSla.historyId === h.id && !loan.liveSla.error ? loan.liveSla : null;
                      const actual = live ? live.actualDurationHours : h.actualDurationHours;
                      const paused = live ? live.pausedDurationHours : h.pausedDurationHours;
                      const net = live ? live.netWorkDurationHours : h.netWorkDurationHours;
                      const isCompletedStage = h.stage?.stageCode === 'HOAN_TAT';
                      return (
                      <tr key={i}>
                        <td>
                          <strong>{h.stage?.stageName || h.stageId}</strong>
                        </td>
                        <td style={{ fontSize: '12px' }}>{slaPolicyLabel(h.slaPolicy)}</td>
                        <td style={{ fontSize: '12px' }}>
                          {new Date(h.enteredAt).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {h.exitedAt ? new Date(h.exitedAt).toLocaleString('vi-VN') : 'Đang xử lý...'}
                        </td>
                        <td>{isCompletedStage ? '—' : stageDurationText(actual, h.slaPolicy)}</td>
                        <td>
                          {isCompletedStage ? '—' : (paused ?? 0) > 0 ? (
                            <span style={{ color: '#ea580c', fontWeight: 600 }}>{stageDurationText(paused, h.slaPolicy)}</span>
                          ) : (
                            stageDurationText(0, h.slaPolicy)
                          )}
                        </td>
                        <td>
                          <strong>{isCompletedStage ? '—' : stageDurationText(net, h.slaPolicy)}</strong>
                        </td>
                        <td>{stageStandardText(h.stage?.stageCode, h.slaStandardHours, h.slaPolicy ?? null)}</td>
                        <td>
                          {isCompletedStage ? (
                            <span className="badge badge-soft-gray">Không tính SLA</span>
                          ) : !h.exitedAt && loan.slaSummary?.waitingEnterprise ? (
                            <span className="badge badge-soft-orange">Tạm dừng</span>
                          ) : (live ? live.isDelayed : h.isDelayed) ? (
                            <span className="badge badge-soft-red">Trễ hạn SLA</span>
                          ) : h.exitedAt ? (
                            <span className="badge badge-soft-green">Đúng hạn</span>
                          ) : (
                            <span className="badge badge-soft-blue">Đang chạy</span>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        Chưa có lịch sử công đoạn
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: '10px 4px 0' }}>
                Tình trạng SLA hiện tại: {slaSummaryText(loan.slaSummary, loan.currentStage === 'HOAN_TAT')}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 4px 0' }}>
                Cách cũ: giờ thực 24/7. PA1: giờ làm việc thứ Hai–thứ Sáu, 08:00–12:00 và 13:00–17:00 giờ Việt Nam, loại ngày nghỉ theo lịch, 1 ngày làm việc = 8 giờ; với công đoạn PA1, "Tạm dừng SLA" là thời gian chờ doanh nghiệp và "Thời gian tính SLA" là thời gian ngân hàng xử lý.
                {loan.liveSla?.error && <span style={{ color: '#dc2626' }}> {loan.liveSla.error}</span>}
              </p>
            </div>
          )}

          {/* Tab 2: Danh mục chứng từ */}
          {activeTab === 'documents' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                {reception && !waitingSupplement && <button
                  onClick={handleToggleDocComplete}
                  className={`btn ${loan.isDocumentComplete ? 'btn-success' : 'btn-secondary'}`}
                >
                  <FileCheck size={16} />
                  {loan.isDocumentComplete ? 'Đã xác nhận đủ chứng từ' : 'Xác nhận hồ sơ đầy đủ'}
                </button>}

                {reception && <button onClick={() => setShowDocForm(!showDocForm)} className="btn btn-primary">
                  <Plus size={14} /> Thêm tài liệu
                </button>}
              </div>

              {showDocForm && reception && (
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
                  <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                    <option value="PHAP_LY">Pháp lý (GPKD, Điều lệ)</option>
                    <option value="TAI_CHINH">Tài chính (BCTC, Sao kê)</option>
                    <option value="HOAT_DONG_SX">Hoạt động sản xuất kinh doanh</option>
                    <option value="PHUONG_AN">Phương án kinh doanh</option>
                    <option value="TSBD">Tài sản bảo đảm (Sổ đỏ, Xe)</option>
                    <option value="KHAC">Khác</option>
                    <option value="DU_NO">Dư nợ hiện tại</option>
                  </select>
                  <input
                    type="file"
                    aria-label="Tệp chứng từ"
                    accept={documentFormat(docType).accept}
                    title={`Định dạng ${documentFormat(docType).label}, tối đa 10 MB`}
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    style={{ flex: 1 }}
                  />
                  <button onClick={handleAddDocument} disabled={actionLoading} className="btn btn-primary">
                    Lưu
                  </button>
                </div>
              )}

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Loại chứng từ</th>
                      <th>Tên tệp</th>
                      <th>Kích thước</th>
                      <th>Thời gian tải</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.documents && loan.documents.length > 0 ? (
                      loan.documents.map((doc) => (
                        <tr key={doc.id}>
                          <td>
                            <span className="badge badge-soft-blue">{documentTypeLabel(doc.documentType)}</span>
                          </td>
                          <td><button className="btn" onClick={async () => { try { const blob = await api.download(`/documents/${doc.id}/download`); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = doc.fileName; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (err) { alert((err as Error).message); } }}>{doc.fileName}</button></td>
                          <td>{(doc.fileSize / 1024 / 1024).toFixed(1)} MB</td>
                          <td>{new Date(doc.uploadedAt).toLocaleString('vi-VN')}</td>
                          <td>
                            {reception && <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="btn btn-outline-danger"
                              style={{ padding: '4px 8px' }}
                            >
                              <Trash2 size={13} />
                            </button>}
                          </td>
                        </tr>
                      ))
                    ) : null}
                    {acceptedSupplementFiles.map((suppFile) => (
                      <tr key={suppFile.id} style={{ background: 'rgba(16, 185, 129, 0.04)' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="badge badge-soft-green">Bổ sung</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {documentTypeName(portalConfig, suppFile.documentType)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn"
                            style={{ fontWeight: 600 }}
                            title="Tải tệp bổ sung hiện hành đã được chấp nhận"
                            onClick={async () => {
                              try {
                                const blob = await api.download(`/supplements/${suppFile.supplementId}/files/${suppFile.id}/download`);
                                const url = URL.createObjectURL(blob);
                                const anchor = document.createElement('a');
                                anchor.href = url;
                                anchor.download = suppFile.fileName;
                                anchor.click();
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                              } catch (err) {
                                alert((err as Error).message);
                              }
                            }}
                          >
                            {suppFile.fileName}
                          </button>
                          {suppFile.version > 1 && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 6 }}>
                              (v{suppFile.version})
                            </span>
                          )}
                        </td>
                        <td>{(suppFile.fileSize / 1024 / 1024).toFixed(1)} MB</td>
                        <td>{new Date(suppFile.uploadedAt).toLocaleString('vi-VN')}</td>
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--badge-green-text)', fontWeight: 600 }}>
                            Đã chấp nhận
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!loan.documents?.length && !acceptedSupplementFiles.length && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          Chưa có tài liệu đính kèm
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Bổ sung hồ sơ & Tạm dừng SLA */}
          {activeTab === 'supplements' && (
            loan.portalRequest?.status === 'ACCEPTED' ? <SupplementPanel key={loan.id} mode="staff" applicationId={loan.id} supplementIds={(loan.supplementRequests ?? []).map(item => item.id)} canEdit={canEdit} canCreate={!waitingSupplement && !loan.completedAt} config={portalConfig} onChanged={() => { void fetchDetail(); onRefresh(); }} /> : <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Khi yêu cầu bổ sung chứng từ, <strong>đồng hồ đo SLA sẽ tự động tạm dừng</strong> cho đến khi doanh nghiệp nộp lại đầy đủ.
                </p>
                {canEdit && !waitingSupplement && <button
                  onClick={() => setShowSupplementForm(!showSupplementForm)}
                  className="btn btn-warning"
                >
                  <PauseCircle size={16} /> Yêu cầu bổ sung chứng từ
                </button>}
              </div>

              {showSupplementForm && canEdit && !waitingSupplement && (
                <div style={{ background: 'var(--badge-amber-bg)', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid var(--badge-amber-border)' }}>
                  <h4 style={{ color: 'var(--badge-amber-text)', fontSize: '14px', marginBottom: 8, fontWeight: 600 }}>
                    Tạo yêu cầu bổ sung tài liệu (Đồng hồ SLA sẽ tạm dừng)
                  </h4>
                  <textarea
                    rows={2}
                    placeholder="Liệt kê danh mục chứng từ doanh nghiệp cần bổ sung..."
                    value={supplementContent}
                    onChange={(e) => setSupplementContent(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setShowSupplementForm(false)} className="btn btn-secondary">Hủy</button>
                    <button onClick={handleCreateSupplement} disabled={actionLoading || !supplementContent.trim()} className="btn btn-warning">
                      Gửi yêu cầu & Tạm dừng SLA
                    </button>
                  </div>
                </div>
              )}

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nội dung yêu cầu</th>
                      <th>Ngày gửi</th>
                      <th>Người yêu cầu</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.supplementRequests && loan.supplementRequests.length > 0 ? (
                      loan.supplementRequests.map((supp) => (
                        <tr key={supp.id}>
                          <td>{supp.requestContent}</td>
                          <td>{new Date(supp.requestedAt).toLocaleString('vi-VN')}</td>
                          <td>{supp.requester?.fullName || 'Cán bộ tín dụng'}</td>
                          <td>
                            {supp.status === 'RESOLVED' ? (
                              <span className="badge badge-soft-green">Đã hoàn tất</span>
                            ) : (
                              <span className="badge badge-soft-orange">Đang chờ bổ sung</span>
                            )}
                          </td>
                          <td>
                            {supp.status === 'PENDING' && canEdit && (
                              <button
                                onClick={() => handleResolveSupplement(supp.id)}
                                disabled={actionLoading}
                                className="btn btn-success"
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                              >
                                <PlayCircle size={14} /> Đã nhận đủ từ doanh nghiệp
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          Chưa có yêu cầu bổ sung chứng từ nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Thao tác nghiệp vụ */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Trạng thái: <strong>{loanStatusView(loan.currentStatus).label}</strong> • Công đoạn: <strong>{stageLabel(loan.currentStage)}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {/* Nếu đang ở Tiếp nhận -> nút chuyển Thẩm định */}
            {reception && !loan.businessPolicyVersion && !waitingSupplement && loan.isDocumentComplete && (
              <button onClick={handleTransitionToAppraisal} disabled={actionLoading} className="btn btn-primary">
                <Send size={15} /> Chuyển sang Thẩm định
              </button>
            )}

            {/* Phê duyệt / Từ chối */}
            {appraisal && !waitingSupplement && (!loan.businessPolicyVersion || !!reportVersionId) && (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={actionLoading || decisionBlocked || isMakerCheckerDecisionBlocked}
                  title={isMakerCheckerDecisionBlocked ? loan.makerCheckerRestrictions?.decisionBlockReason || undefined : undefined}
                  className="btn btn-danger"
                >
                  Từ chối (TC01 - TC05)
                </button>
                {!isExceedBranchLimit && (
                  <button
                    onClick={() => setShowApproveForm(true)}
                    disabled={actionLoading || decisionBlocked || isMakerCheckerDecisionBlocked}
                    title={isMakerCheckerDecisionBlocked ? loan.makerCheckerRestrictions?.decisionBlockReason || undefined : undefined}
                    className="btn btn-success"
                  >
                    <Check size={16} /> Phê duyệt Khoản vay
                  </button>
                )}
              </>
            )}

            {canCloseOverdue(loan, activeRole) && (
              <button
                onClick={() => setShowCloseForm(true)}
                disabled={actionLoading || isMakerCheckerCloseBlocked}
                title={isMakerCheckerCloseBlocked ? loan.makerCheckerRestrictions?.closeOverdueBlockReason || undefined : undefined}
                className="btn btn-danger"
              >
                Đóng hồ sơ do quá hạn
              </button>
            )}

            <button onClick={onClose} className="btn btn-secondary">
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
