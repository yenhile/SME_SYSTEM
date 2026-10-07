import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { OfficerWorkload, LoanApplication } from '../types';
import { Users, ArrowRightLeft, RefreshCw } from 'lucide-react';

export const AssignmentsView: React.FC = () => {
  const [workloads, setWorkloads] = useState<OfficerWorkload[]>([]);
  const [activeLoans, setActiveLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal điều chuyển
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [targetOfficerId, setTargetOfficerId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('Phân bổ lại tải công việc chi nhánh để tránh chậm hạn SLA');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [workloadsData, loansData] = await Promise.all([
        api.get<OfficerWorkload[]>('/assignments/officer-workloads'),
        api.get<LoanApplication[]>('/loan-applications'),
      ]);
      setWorkloads(workloadsData);
      const active = loansData.filter((l) =>
        ['RECEIVED', 'CHECKED', 'SUPPLEMENT_REQUIRED', 'PENDING_APPRAISAL', 'WAITING_HEAD_OFFICE'].includes(l.currentStatus)
      );
      setActiveLoans(active);

      if (workloadsData.length > 0) {
        setTargetOfficerId(workloadsData[0].id);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu phân công:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenReassignModal = (loan: LoanApplication) => {
    setSelectedLoan(loan);
    setMsg(null);
    const available = workloads.find((w) => w.id !== loan.assignedTo);
    if (available) {
      setTargetOfficerId(available.id);
    }
  };

  const handleExecuteReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !targetOfficerId) return;

    setSubmitting(true);
    setMsg(null);
    try {
      await api.post(`/assignments/${selectedLoan.id}/reassign`, {
        newOfficerId: targetOfficerId,
        reason: reassignReason,
      });

      setMsg({ text: 'Điều chuyển hồ sơ thành công! AI đã tự động tái đánh giá lại rủi ro SLA.', type: 'success' });
      await fetchData();
      setTimeout(() => {
        setSelectedLoan(null);
      }, 1500);
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi điều chuyển hồ sơ', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Điều phối & Quản lý Tải Cán bộ Tín dụng (CBTD)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Theo dõi khối lượng hồ sơ của từng cán bộ và điều chuyển linh hoạt nhằm giảm thiểu nguy cơ tắc nghẽn SLA
          </p>
        </div>

        <button onClick={fetchData} className="btn btn-secondary">
          <RefreshCw size={15} /> Làm mới
        </button>
      </div>

      {/* Khối 1: Bảng Tải công việc Cán bộ Trắng Sáng */}
      <div className="card" style={{ marginBottom: 24, background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Users size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
              Bảng Giám sát Tải Công việc (CBTD Workload Monitoring)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Ưu tiên điều chuyển sang cán bộ đang ở trạng thái Khả dụng (hàng đầu tiên)
            </p>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cán bộ tín dụng</th>
                <th>Số điện thoại</th>
                <th>Chi nhánh</th>
                <th>Hồ sơ đang xử lý</th>
                <th>Hồ sơ cảnh báo đỏ (AI)</th>
                <th>Tình trạng tải</th>
              </tr>
            </thead>
            <tbody>
              {workloads.map((officer) => (
                <tr key={officer.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{officer.fullName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{officer.username}</div>
                  </td>
                  <td>{officer.phone || '0901234567'}</td>
                  <td>{officer.branchName}</td>
                  <td>
                    <strong style={{ fontSize: '15px', color: '#0369a1' }}>{officer.activeLoanCount}</strong> hồ sơ
                  </td>
                  <td>
                    {officer.highRiskLoanCount > 0 ? (
                      <span className="badge badge-soft-red">{officer.highRiskLoanCount} hồ sơ</span>
                    ) : (
                      <span className="badge badge-soft-green">0 hồ sơ</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        officer.workloadStatus === 'QUÁ TẢI'
                          ? 'badge-soft-red'
                          : officer.workloadStatus === 'BẬN RỘN'
                          ? 'badge-soft-amber'
                          : 'badge-soft-green'
                      }`}
                      style={{ fontWeight: 700 }}
                    >
                      {officer.workloadStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Khối 2: Danh sách hồ sơ có thể điều chuyển */}
      <div className="card" style={{ background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--badge-amber-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
            }}
          >
            <ArrowRightLeft size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
              Danh sách Hồ sơ Đang xử lý (Sẵn sàng Điều chuyển)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Nhấp nút "Điều chuyển" để chuyển giao hồ sơ sang cán bộ có tải thấp hơn
            </p>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã hồ sơ</th>
                <th>Doanh nghiệp</th>
                <th>Số tiền vay</th>
                <th>Công đoạn</th>
                <th>Cán bộ hiện tại</th>
                <th>Nguy cơ trễ hạn (AI)</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {activeLoans.map((loan) => {
                const latestPred = loan.delayPredictions?.[0];

                return (
                  <tr key={loan.id}>
                    <td>
                      <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                        {loan.applicationCode}
                      </strong>
                    </td>
                    <td>{loan.company.companyName}</td>
                    <td>{Number(loan.officialAmount || loan.proposedAmount).toLocaleString('vi-VN')} VNĐ</td>
                    <td>
                      <span className="badge badge-soft-gray">{loan.currentStage}</span>
                    </td>
                    <td>{loan.assignedUser?.fullName || 'Chưa phân công'}</td>
                    <td>
                      {latestPred ? (
                        <span
                          className={`badge ${
                            latestPred.riskLevel === 'CAO'
                              ? 'badge-soft-red'
                              : latestPred.riskLevel === 'TRUNG_BINH'
                              ? 'badge-soft-amber'
                              : 'badge-soft-green'
                          }`}
                        >
                          {latestPred.riskLevel} ({(latestPred.delayProbability * 100).toFixed(0)}%)
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleOpenReassignModal(loan)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        <ArrowRightLeft size={13} /> Điều chuyển
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thực hiện điều chuyển */}
      {selectedLoan && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '15px' }}>Điều chuyển Hồ sơ: {selectedLoan.applicationCode}</h3>
              <button onClick={() => setSelectedLoan(null)} className="btn btn-secondary" style={{ padding: '6px' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteReassign}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {msg && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      fontSize: '13px',
                      backgroundColor: msg.type === 'success' ? 'var(--badge-green-bg)' : 'var(--badge-red-bg)',
                      border: `1px solid ${msg.type === 'success' ? 'var(--badge-green-border)' : 'var(--badge-red-border)'}`,
                      color: msg.type === 'success' ? 'var(--badge-green-text)' : 'var(--badge-red-text)',
                    }}
                  >
                    {msg.text}
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Doanh nghiệp vay vốn:
                  </label>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedLoan.company.companyName}</div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Cán bộ đang phụ trách:
                  </label>
                  <div style={{ color: '#ea580c', fontWeight: 600 }}>
                    {selectedLoan.assignedUser?.fullName || 'Chưa gán'} (@{selectedLoan.assignedUser?.username})
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Chọn Cán bộ tiếp nhận mới (Ưu tiên cán bộ khả dụng):
                  </label>
                  <select
                    value={targetOfficerId}
                    onChange={(e) => setTargetOfficerId(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  >
                    {workloads.map((w) => (
                      <option key={w.id} value={w.id} disabled={w.id === selectedLoan.assignedTo}>
                        {w.fullName} • Đang xử lý: {w.activeLoanCount} hồ sơ ({w.workloadStatus})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Lý do điều chuyển:
                  </label>
                  <textarea
                    rows={2}
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setSelectedLoan(null)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Đang điều chuyển...' : 'Xác nhận Điều chuyển'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
