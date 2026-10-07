import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
}

export const LoanDetailModal: React.FC<LoanDetailModalProps> = ({
  applicationId,
  onClose,
  onRefresh,
}) => {
  const { user } = useAuth();
  const [loan, setLoan] = useState<LoanApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'documents' | 'supplements'>('timeline');

  // Form states cho bổ sung hồ sơ
  const [supplementContent, setSupplementContent] = useState('');
  const [showSupplementForm, setShowSupplementForm] = useState(false);

  // Form states cho duyệt/từ chối
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [approvedInterestRate, setApprovedInterestRate] = useState<number>(8.5);

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReasonCode, setRejectionReasonCode] = useState('TC02');
  const [rejectionNote, setRejectionNote] = useState('');

  // Form state cho upload document
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('PHAP_LY');
  const [docName, setDocName] = useState('');

  // Form xác định hạn mức vay chính thức
  const [showSetAmountForm, setShowSetAmountForm] = useState(false);
  const [officialAmountInput, setOfficialAmountInput] = useState<number>(0);

  const fetchDetail = async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const data = await api.get<LoanApplication>(`/loan-applications/${applicationId}`);
      setLoan(data);
      setApprovedAmount(Number(data.officialAmount || data.proposedAmount));
      setOfficialAmountInput(Number(data.officialAmount || data.proposedAmount));
    } catch (err: any) {
      alert(`Không thể tải chi tiết hồ sơ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [applicationId]);

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

  // 2. Chuyển sang Cấp trên / Hội đồng tín dụng (nếu > 10 tỷ)
  const handleTransitionToHeadOffice = async () => {
    if (!window.confirm('Khoản vay vượt hạn mức chi nhánh (> 10 tỷ VNĐ). Chuyển hồ sơ lên Cấp trên / Hội đồng tín dụng?')) return;
    setActionLoading(true);
    try {
      await api.post(`/workflow/${loan.id}/transition`, {
        targetStage: 'CAP_TREN',
        targetStatus: 'WAITING_HEAD_OFFICE',
        notes: 'Trình Hội đồng tín dụng / Cấp trên phê duyệt theo quy định phân quyền',
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
  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await api.post(`/workflow/${loan.id}/transition`, {
        targetStage: 'HOAN_TAT',
        targetStatus: 'APPROVED',
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

  // 4. Từ chối khoản vay
  const handleReject = async () => {
    if (!rejectionNote.trim()) {
      alert('Vui lòng nhập lý do giải thích từ chối');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/workflow/${loan.id}/transition`, {
        targetStage: 'HOAN_TAT',
        targetStatus: 'REJECTED',
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
      await api.post(`/prediction/predict/${loan.id}`);
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
    if (!docName.trim()) {
      alert('Vui lòng nhập tên tài liệu');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/documents/${loan.id}`, {
        documentType: docType,
        fileName: docName,
        filePath: `/uploads/mock_${Date.now()}.pdf`,
        fileSize: 1024 * 1024 * 2, // 2MB
      });
      setDocName('');
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

  const latestPrediction = loan.delayPredictions?.[0];
  let topReasons: string[] = [];
  if (latestPrediction?.topReasonsJson) {
    try {
      topReasons = JSON.parse(latestPrediction.topReasonsJson);
    } catch {
      topReasons = [latestPrediction.topReasonsJson];
    }
  }

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
    if (st === 'CAP_TREN') return 3;
    return 4;
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
                <h3 style={{ fontSize: '17px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {loan.applicationCode}
                </h3>
                {loan.currentStatus === 'APPROVED' ? (
                  <span className="badge badge-soft-green">🟢 Đã phê duyệt</span>
                ) : loan.currentStatus === 'REJECTED' ? (
                  <span className="badge badge-soft-red">🔴 Bị từ chối</span>
                ) : loan.currentStatus === 'SUPPLEMENT_REQUIRED' ? (
                  <span className="badge badge-soft-orange">🟡 Chờ bổ sung (Tạm dừng SLA)</span>
                ) : loan.currentStatus === 'PENDING_APPRAISAL' ? (
                  <span className="badge badge-soft-amber">🟡 Đang thẩm định</span>
                ) : loan.currentStatus === 'WAITING_HEAD_OFFICE' ? (
                  <span className="badge badge-soft-purple">🟣 Chờ Cấp trên duyệt</span>
                ) : (
                  <span className="badge badge-soft-blue">🔵 Đang xử lý</span>
                )}
                {loan.supplementCount > 0 && (
                  <span className="badge badge-soft-orange">Đã bổ sung {loan.supplementCount} lần</span>
                )}
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
          {/* C. THANH TIẾN TRÌNH QUY TRÌNH (WORKFLOW PROGRESS BAR) TRÊN CÙNG MÀN HÌNH */}
          <div className="workflow-progress-bar">
            <div className={`progress-step ${currentStepIdx >= 1 ? (currentStepIdx === 1 ? 'active' : 'completed') : ''}`}>
              <div className="progress-step-circle">{currentStepIdx > 1 ? '✓' : '1'}</div>
              <div className="progress-step-text">
                <h4>Tiếp nhận</h4>
                <p>SLA: 4 giờ</p>
              </div>
            </div>

            <div className={`progress-step-line ${currentStepIdx > 1 ? 'completed' : ''}`} />

            <div className={`progress-step ${currentStepIdx >= 2 ? (currentStepIdx === 2 ? 'active' : 'completed') : ''}`}>
              <div className="progress-step-circle">{currentStepIdx > 2 ? '✓' : '2'}</div>
              <div className="progress-step-text">
                <h4>Thẩm định</h4>
                <p>SLA: 12 giờ</p>
              </div>
            </div>

            <div className={`progress-step-line ${currentStepIdx > 2 ? 'completed' : ''}`} />

            <div className={`progress-step ${currentStepIdx >= 3 ? (currentStepIdx === 3 ? 'active' : 'completed') : ''}`}>
              <div className="progress-step-circle">{currentStepIdx > 3 ? '✓' : '3'}</div>
              <div className="progress-step-text">
                <h4>Hội đồng / Cấp trên</h4>
                <p>SLA: 24 giờ</p>
              </div>
            </div>

            <div className={`progress-step-line ${currentStepIdx > 3 ? 'completed' : ''}`} />

            <div className={`progress-step ${currentStepIdx === 4 ? 'completed' : ''}`}>
              <div className="progress-step-circle">{currentStepIdx === 4 ? '✓' : '4'}</div>
              <div className="progress-step-text">
                <h4>Phê duyệt & Giải ngân</h4>
                <p>SLA: 4 giờ</p>
              </div>
            </div>
          </div>

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
                <h4 style={{ fontSize: '13.5px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  AI Early Warning • Dự báo nguy cơ trễ hạn SLA
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
                  style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 700 }}
                >
                  MỨC RỦI RO: {latestPrediction ? latestPrediction.riskLevel : 'CHƯA ĐÁNH GIÁ'}
                </span>
                <button
                  onClick={handleRePredict}
                  disabled={actionLoading}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11px', background: '#ffffff' }}
                >
                  Chạy lại AI
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 16, alignItems: 'center' }}>
              <div style={{ borderRight: '1px solid rgba(0,0,0,0.08)', paddingRight: 16 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Xác suất trễ hạn (SLA)</div>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color:
                      latestPrediction?.riskLevel === 'CAO'
                        ? '#991b1b'
                        : latestPrediction?.riskLevel === 'TRUNG_BINH'
                        ? '#92400e'
                        : '#065f46',
                  }}
                >
                  {latestPrediction ? `${(latestPrediction.delayProbability * 100).toFixed(1)}%` : '0%'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Mô hình: {latestPrediction?.modelVersion || 'RandomForest-v1'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Các yếu tố chính giải thích rủi ro (Explainable AI / Feature Contributions):
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
                        <span style={{ color: '#ea580c', fontWeight: 'bold' }}>•</span>
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
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>SỐ TIỀN ĐỀ XUẤT</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0369a1', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {formatVnd(loan.proposedAmount)}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Thời hạn: {loan.loanTermMonths} tháng
              </span>
            </div>

            {/* Thẻ Hạn mức chính thức */}
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>HẠN MỨC CHÍNH THỨC</span>
                <button
                  onClick={() => setShowSetAmountForm(!showSetAmountForm)}
                  style={{ background: 'none', color: '#0284c7', fontSize: '11px', fontWeight: 700, padding: 0 }}
                >
                  Sửa
                </button>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {loan.officialAmount ? formatVnd(loan.officialAmount) : 'Chưa định mức'}
              </div>
              {isExceedBranchLimit ? (
                <div className="risk-alert-inline danger">
                  <AlertCircle size={12} /> Vượt 10 tỷ (Cần Cấp trên)
                </div>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--badge-green-text)' }}>≤ 10 tỷ (Duyệt tại chi nhánh)</span>
              )}
            </div>

            {/* Thẻ Tỷ lệ Đòn bẩy Nợ/Vốn (Risk Alert) */}
            <div className="card" style={{ padding: '14px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TỶ LỆ NỢ / VỐN (D/E)</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: isHighLeverage ? '#dc2626' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {debtToEquity} lần
              </div>
              {isHighLeverage ? (
                <div className="risk-alert-inline danger">
                  <AlertTriangle size={12} /> Đòn bẩy cao (&gt; 2.0)
                </div>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--badge-green-text)' }}>Mức đòn bẩy an toàn</span>
              )}
            </div>

            {/* Thẻ Cán bộ phụ trách */}
            <div className="card" style={{ padding: '14px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>CÁN BỘ PHỤ TRÁCH</span>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                {loan.assignedUser?.fullName || 'Chưa gán'}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                @{loan.assignedUser?.username}
              </span>
            </div>
          </div>

          {/* Form sửa hạn mức chính thức */}
          {showSetAmountForm && (
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
              </div>
              <button onClick={handleSetOfficialAmount} disabled={actionLoading} className="btn btn-primary" style={{ marginTop: 18 }}>
                Lưu hạn mức
              </button>
            </div>
          )}

          {/* Form Phê duyệt */}
          {showApproveForm && (
            <div style={{ background: 'var(--badge-green-bg)', padding: '16px', borderRadius: 8, border: '1px solid var(--badge-green-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ color: 'var(--badge-green-text)', fontSize: '14px', fontWeight: 700 }}>
                Xác nhận Phê duyệt Cấp tín dụng
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Số tiền phê duyệt (VNĐ):</label>
                  <input
                    type="number"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(Number(e.target.value))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Lãi suất phê duyệt (%/năm):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={approvedInterestRate}
                    onChange={(e) => setApprovedInterestRate(Number(e.target.value))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowApproveForm(false)} className="btn btn-secondary">Hủy</button>
                <button onClick={handleApprove} disabled={actionLoading} className="btn btn-success">
                  Xác nhận Phê duyệt
                </button>
              </div>
            </div>
          )}

          {/* Form Từ chối */}
          {showRejectForm && (
            <div style={{ background: 'var(--badge-red-bg)', padding: '16px', borderRadius: 8, border: '1px solid var(--badge-red-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ color: 'var(--badge-red-text)', fontSize: '14px', fontWeight: 700 }}>
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
                <button onClick={handleReject} disabled={actionLoading} className="btn btn-danger">
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
                fontWeight: 700,
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
                fontWeight: 700,
              }}
            >
              Danh mục chứng từ ({loan.documents?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('supplements')}
              style={{
                background: 'none',
                padding: '8px 12px',
                borderBottom: activeTab === 'supplements' ? '2px solid var(--primary)' : 'none',
                color: activeTab === 'supplements' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 700,
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
                    loan.stageHistories.map((h, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{h.stage?.stageName || h.stageId}</strong>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {new Date(h.enteredAt).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {h.exitedAt ? new Date(h.exitedAt).toLocaleString('vi-VN') : 'Đang xử lý...'}
                        </td>
                        <td>{h.actualDurationHours !== null ? `${h.actualDurationHours}h` : '—'}</td>
                        <td>
                          {h.pausedDurationHours > 0 ? (
                            <span style={{ color: '#ea580c', fontWeight: 600 }}>{h.pausedDurationHours}h</span>
                          ) : (
                            '0h'
                          )}
                        </td>
                        <td>
                          <strong>{h.netWorkDurationHours !== null ? `${h.netWorkDurationHours}h` : '—'}</strong>
                        </td>
                        <td>{h.slaStandardHours}h</td>
                        <td>
                          {h.isDelayed ? (
                            <span className="badge badge-soft-red">Trễ hạn SLA</span>
                          ) : h.exitedAt ? (
                            <span className="badge badge-soft-green">Đúng hạn</span>
                          ) : (
                            <span className="badge badge-soft-blue">Đang chạy</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        Chưa có lịch sử công đoạn
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Danh mục chứng từ */}
          {activeTab === 'documents' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <button
                  onClick={handleToggleDocComplete}
                  className={`btn ${loan.isDocumentComplete ? 'btn-success' : 'btn-secondary'}`}
                >
                  <FileCheck size={16} />
                  {loan.isDocumentComplete ? 'Đã xác nhận đủ chứng từ' : 'Xác nhận hồ sơ đầy đủ'}
                </button>

                <button onClick={() => setShowDocForm(!showDocForm)} className="btn btn-primary">
                  <Plus size={14} /> Thêm tài liệu
                </button>
              </div>

              {showDocForm && (
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
                  <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                    <option value="PHAP_LY">Pháp lý (GPKD, Điều lệ)</option>
                    <option value="TAI_CHINH">Tài chính (BCTC, Sao kê)</option>
                    <option value="PHUONG_AN">Phương án kinh doanh</option>
                    <option value="TSBD">Tài sản bảo đảm (Sổ đỏ, Xe)</option>
                    <option value="KHAC">Khác</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Tên tệp tin (ví dụ: BCTC_2025.pdf)"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
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
                            <span className="badge badge-soft-blue">{doc.documentType}</span>
                          </td>
                          <td>{doc.fileName}</td>
                          <td>{(doc.fileSize / 1024 / 1024).toFixed(1)} MB</td>
                          <td>{new Date(doc.uploadedAt).toLocaleString('vi-VN')}</td>
                          <td>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="btn btn-outline-danger"
                              style={{ padding: '4px 8px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
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
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Khi yêu cầu bổ sung chứng từ, <strong>đồng hồ đo SLA sẽ tự động tạm dừng</strong> cho đến khi doanh nghiệp nộp lại đầy đủ.
                </p>
                <button
                  onClick={() => setShowSupplementForm(!showSupplementForm)}
                  className="btn btn-warning"
                >
                  <PauseCircle size={16} /> Yêu cầu bổ sung chứng từ
                </button>
              </div>

              {showSupplementForm && (
                <div style={{ background: 'var(--badge-amber-bg)', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid var(--badge-amber-border)' }}>
                  <h4 style={{ color: 'var(--badge-amber-text)', fontSize: '13.5px', marginBottom: 8, fontWeight: 700 }}>
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
                    <button onClick={handleCreateSupplement} disabled={actionLoading} className="btn btn-warning">
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
                            {supp.status === 'PENDING' && (
                              <button
                                onClick={() => handleResolveSupplement(supp.id)}
                                disabled={actionLoading}
                                className="btn btn-success"
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                              >
                                <PlayCircle size={14} /> Tiếp nhận & Chạy lại SLA
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
              Trạng thái: <strong>{loan.currentStatus}</strong> • Công đoạn: <strong>{loan.currentStage}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {/* Nếu đang ở Tiếp nhận -> nút chuyển Thẩm định */}
            {loan.currentStage === 'TIEP_NHAN' && (
              <button onClick={handleTransitionToAppraisal} disabled={actionLoading} className="btn btn-primary">
                <Send size={15} /> Chuyển sang Thẩm định
              </button>
            )}

            {/* Nếu đang ở Thẩm định và hạn mức > 10 tỷ -> nút chuyển Cấp trên */}
            {loan.currentStage === 'THAM_DINH' && Number(loan.officialAmount || loan.proposedAmount) > 10000000000 && (
              <button onClick={handleTransitionToHeadOffice} disabled={actionLoading} className="btn btn-warning">
                <Send size={15} /> Trình Hội đồng / Cấp trên (&gt; 10 tỷ)
              </button>
            )}

            {/* Phê duyệt / Từ chối */}
            {['THAM_DINH', 'CAP_TREN'].includes(loan.currentStage) && (
              <>
                <button onClick={() => setShowRejectForm(true)} disabled={actionLoading} className="btn btn-danger">
                  Từ chối (TC01 - TC05)
                </button>
                <button onClick={() => setShowApproveForm(true)} disabled={actionLoading} className="btn btn-success">
                  <Check size={16} /> Phê duyệt Khoản vay
                </button>
              </>
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
