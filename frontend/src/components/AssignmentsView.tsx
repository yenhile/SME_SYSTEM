import React, { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '../api/client';
import { OfficerWorkload, LoanApplication } from '../types';
import { Users, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { predictionLabel } from '../slaDisplay';
import {AssignmentChangeRequestsView} from './AssignmentChangeRequestsView';

export const AssignmentsView: React.FC<{onOpenCase?:(subject:{type:'LOAN'|'PORTAL';id:string})=>void}> = ({onOpenCase}) => {
  const [workloads, setWorkloads] = useState<OfficerWorkload[]>([]);
  const [activeLoans, setActiveLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal điều chuyển
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [targetOfficerId, setTargetOfficerId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('Phân bổ lại tải công việc chi nhánh để tránh chậm hạn SLA');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [conflict,setConflict]=useState(false);
  const operation=useRef<{key:string;id:string}|null>(null);
  const submitLock=useRef(false);
  const sequence=useRef(0);

  const fetchData = async () => {
    const current=++sequence.current;
    setLoading(true);
    try {
      const [workloadsData, loansData] = await Promise.all([
        api.get<OfficerWorkload[]>('/assignments/officer-workloads'),
        api.get<LoanApplication[]>('/loan-applications'),
      ]);
      if(current!==sequence.current)return false;
      setWorkloads(workloadsData);
      const active = loansData.filter((l) =>
        ['RECEIVED', 'CHECKED', 'SUPPLEMENT_REQUIRED', 'PENDING_APPRAISAL'].includes(l.currentStatus)
      );
      setActiveLoans(active);

      return true;
    } catch (err: any) {
      if(current===sequence.current)setMsg({ text: err.message, type: 'error' });
      return false;
    } finally {
      if(current===sequence.current)setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenReassignModal = (loan: LoanApplication) => {
    setSelectedLoan(loan);
    setMsg(null);
    setTargetOfficerId('');setConflict(false);operation.current=null;
    setReassignReason('Phân bổ lại tải công việc chi nhánh để tránh chậm hạn SLA');
  };

  const reloadAssignment=async()=>{
    if(!selectedLoan||submitLock.current)return;
    submitLock.current=true;setSubmitting(true);
    try{
      const current=await api.get<LoanApplication>(`/loan-applications/${selectedLoan.id}`);
      if(current.completedAt||current.currentStage==='HOAN_TAT'){setSelectedLoan(null);setMsg({text:'Hồ sơ đã kết thúc, không thể điều chuyển.',type:'error'});}
      else{setSelectedLoan(current);setTargetOfficerId('');setConflict(false);operation.current=null;setMsg(null);}
      await fetchData();
    }catch(err){setMsg({text:(err as Error).message,type:'error'});}
    finally{submitLock.current=false;setSubmitting(false);}
  };

  const handleExecuteReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !targetOfficerId || submitLock.current || conflict) return;
    const reason=reassignReason.trim();
    if(!reason||reason.length>2000){setMsg({text:'Vui lòng nhập lý do điều chuyển, tối đa 2.000 ký tự.',type:'error'});return;}
    if(!Number.isSafeInteger(selectedLoan.assignmentVersion)){setMsg({text:'Dữ liệu phân công chưa có phiên bản. Vui lòng tải lại màn hình.',type:'error'});return;}
    const key=JSON.stringify([selectedLoan.id,selectedLoan.assignmentVersion,targetOfficerId,reason]);
    if(operation.current?.key!==key)operation.current={key,id:crypto.randomUUID()};

    submitLock.current=true;
    setSubmitting(true);
    setMsg(null);
    try {
      const result=await api.post<{replayed:boolean;prediction:{status:string;message:string}}>(`/assignments/${selectedLoan.id}/reassign`, {
        newOfficerId: targetOfficerId,
        reason,
        expectedAssignmentVersion:selectedLoan.assignmentVersion,
        clientRequestId:operation.current.id,
      });

      setSelectedLoan(null);setTargetOfficerId('');operation.current=null;
      const refreshed=await fetchData();
      if(!refreshed)setMsg({text:'Thao tác đã được lưu nhưng chưa làm mới được danh sách. Bấm Làm mới để đối chiếu phân công hiện tại.',type:'error'});
      else setMsg({ text: result.replayed?'Thao tác này đã được ghi nhận trước đó. Danh sách đã hiển thị phân công hiện tại.':`Điều chuyển hồ sơ thành công. ${result.prediction.message}`, type: 'success' });
    } catch (err: any) {
      if(err instanceof ApiError&&err.status===409)setConflict(true);
      setMsg({ text: err.message || 'Lỗi khi điều chuyển hồ sơ', type: 'error' });
    } finally {
      setSubmitting(false);
      submitLock.current=false;
    }
  };

  return (
    <div className="assignments-view">
      <AssignmentChangeRequestsView onOpenCase={onOpenCase} onChanged={async()=>{await fetchData();}}/>
      {msg && !selectedLoan && <p role={msg.type==='error'?'alert':'status'} className={msg.type==='error'?'error-message':'portal-notice'}>{msg.text}</p>}
      <div className="page-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Điều chuyển & phân công
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Theo dõi khối lượng hồ sơ của từng cán bộ và điều chuyển linh hoạt nhằm giảm thiểu nguy cơ tắc nghẽn SLA
          </p>
        </div>

        <button onClick={fetchData} disabled={loading||submitting} className="btn btn-secondary">
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
            <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
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
                <th>Hồ sơ cảnh báo Khẩn</th>
                <th>Tình trạng tải</th>
              </tr>
            </thead>
            <tbody>
              {workloads.map((officer) => (
                <tr key={officer.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{officer.fullName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{officer.username}</div>
                  </td>
                  <td>{officer.phone || '—'}</td>
                  <td>{officer.branchName}</td>
                  <td>
                    <strong style={{ fontSize: '14px', color: 'var(--primary-hover)' }}>{officer.totalAssignedCount}</strong> công việc<div>{officer.activeLoanCount} hồ sơ vay · {officer.pendingIntakeCount} đề nghị Portal</div>
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
                      style={{ fontWeight: 600 }}
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
            <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
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
                        loan.predictionStatus === 'INCOMPATIBLE_PA1' ? predictionLabel(loan.predictionStatus) : '—'
                      )}
                    </td>
                    <td>
                      <button
                        disabled={loading || submitting}
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
              <h3 style={{ fontSize: '14px' }}>Điều chuyển Hồ sơ: {selectedLoan.applicationCode}</h3>
              <button disabled={submitting} onClick={() => setSelectedLoan(null)} className="btn btn-secondary" style={{ padding: '6px' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteReassign}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {msg && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 4,
                      fontSize: '13px',
                      backgroundColor: msg.type === 'success' ? 'var(--badge-green-bg)' : 'var(--badge-red-bg)',
                      border: `1px solid ${msg.type === 'success' ? 'var(--badge-green-border)' : 'var(--badge-red-border)'}`,
                      color: msg.type === 'success' ? 'var(--badge-green-text)' : 'var(--badge-red-text)',
                    }}
                  >
                    {msg.text}
                  </div>
                )}
                {conflict&&<div role="alert"><p>Phân công đã đổi. Tải lại để đối chiếu trước khi xác nhận một thao tác mới.</p><button type="button" className="btn btn-secondary" disabled={submitting} onClick={()=>void reloadAssignment()}>Tải lại phân công</button></div>}

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Doanh nghiệp vay vốn:
                  </label>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedLoan.company.companyName}</div>
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
                    aria-label="Cán bộ nhận điều chuyển"
                    disabled={submitting||conflict}
                    value={targetOfficerId}
                    onChange={(e) => setTargetOfficerId(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  >
                    <option value="">Chọn cán bộ</option>
                    {workloads.map((w) => (
                      <option key={w.id} value={w.id} disabled={w.id === selectedLoan.assignedTo}>
                        {w.fullName} • Đang xử lý: {w.totalAssignedCount} công việc ({w.activeLoanCount} hồ sơ vay, {w.pendingIntakeCount} Portal) ({w.workloadStatus})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Lý do điều chuyển:
                  </label>
                  <textarea
                    aria-label="Lý do điều chuyển"
                    maxLength={2000}
                    disabled={submitting||conflict}
                    rows={2}
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" disabled={submitting} onClick={() => setSelectedLoan(null)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" disabled={submitting||conflict||!targetOfficerId||targetOfficerId===selectedLoan.assignedTo||!reassignReason.trim()||!Number.isSafeInteger(selectedLoan.assignmentVersion)} className="btn btn-primary">
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
