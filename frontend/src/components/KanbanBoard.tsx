import React from 'react';
import { LoanApplication, StageCode } from '../types';
import { Clock, AlertTriangle, CheckCircle2, User, Building, DollarSign } from 'lucide-react';

interface KanbanBoardProps {
  loans: LoanApplication[];
  onSelectLoan: (loanId: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ loans, onSelectLoan }) => {
  const columns: { stage: StageCode; title: string; sla: string; badgeColor: string }[] = [
    { stage: 'TIEP_NHAN', title: '1. Tiếp nhận hồ sơ', sla: 'SLA: 4 giờ', badgeColor: 'badge-soft-blue' },
    { stage: 'THAM_DINH', title: '2. Thẩm định tín dụng', sla: 'SLA: 12 giờ', badgeColor: 'badge-soft-amber' },
    { stage: 'CAP_TREN', title: '3. Hội đồng / Cấp trên', sla: 'SLA: 24 giờ', badgeColor: 'badge-soft-purple' },
    { stage: 'HOAN_TAT', title: '4. Hoàn tất & Phê duyệt', sla: 'SLA: 4 giờ', badgeColor: 'badge-soft-green' },
  ];

  const getLoanTypeClass = (type: string) => {
    if (type === 'VAY_VON_LUU_DONG') return 'loan-type-vld';
    if (type === 'VAY_DAU_TU_TSCD') return 'loan-type-tscd';
    return 'loan-type-thau-chi';
  };

  const getLoanTypeLabel = (type: string) => {
    if (type === 'VAY_VON_LUU_DONG') return 'Vay VLĐ';
    if (type === 'VAY_DAU_TU_TSCD') return 'Vay đầu tư TSCĐ';
    return 'Thấu chi';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="badge badge-soft-green">🟢 Đã phê duyệt</span>;
      case 'REJECTED':
        return <span className="badge badge-soft-red">🔴 Từ chối</span>;
      case 'SUPPLEMENT_REQUIRED':
        return <span className="badge badge-soft-orange">🟡 Chờ bổ sung</span>;
      case 'PENDING_APPRAISAL':
        return <span className="badge badge-soft-amber">🟡 Đang thẩm định</span>;
      case 'WAITING_HEAD_OFFICE':
        return <span className="badge badge-soft-purple">🟣 Chờ Cấp trên</span>;
      case 'CHECKED':
        return <span className="badge badge-soft-blue">🔵 Đã đủ hồ sơ</span>;
      default:
        return <span className="badge badge-soft-blue">🔵 Mới tiếp nhận</span>;
    }
  };

  const getRiskBadge = (pred?: any) => {
    if (!pred) return null;
    if (pred.riskLevel === 'CAO') {
      return (
        <span className="badge badge-soft-red" style={{ fontWeight: 700 }}>
          ⚠️ Trễ {(pred.delayProbability * 100).toFixed(0)}%
        </span>
      );
    }
    if (pred.riskLevel === 'TRUNG_BINH') {
      return (
        <span className="badge badge-soft-amber">
          Chú ý {(pred.delayProbability * 100).toFixed(0)}%
        </span>
      );
    }
    return (
      <span className="badge badge-soft-green">
        An toàn ({(pred.delayProbability * 100).toFixed(0)}%)
      </span>
    );
  };

  return (
    <div className="kanban-board">
      {columns.map((col) => {
        const colLoans = loans.filter((l) => l.currentStage === col.stage);

        return (
          <div key={col.stage} className="kanban-column">
            <div className="kanban-col-header">
              <h3>
                {col.title}
                <span className="kanban-col-badge">{colLoans.length}</span>
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {col.sla}
              </span>
            </div>

            <div className="kanban-card-list">
              {colLoans.length > 0 ? (
                colLoans.map((loan) => {
                  const latestPred = loan.delayPredictions?.[0];

                  return (
                    <div
                      key={loan.id}
                      className={`kanban-card ${getLoanTypeClass(loan.loanType)}`}
                      onClick={() => onSelectLoan(loan.id)}
                    >
                      <div className="kanban-card-header">
                        <span className="kanban-card-code">{loan.applicationCode}</span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {getLoanTypeLabel(loan.loanType)}
                        </span>
                      </div>

                      <div className="kanban-card-company">{loan.company.companyName}</div>

                      <div className="kanban-card-amount">
                        {Number(loan.officialAmount || loan.proposedAmount).toLocaleString('vi-VN')} VNĐ
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {getStatusBadge(loan.currentStatus)}
                        {getRiskBadge(latestPred)}
                      </div>

                      <div className="kanban-card-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <User size={12} color="#64748b" />
                          <span>{loan.assignedUser?.fullName || 'Chưa phân công'}</span>
                        </div>
                        {loan.supplementCount > 0 && (
                          <span style={{ color: 'var(--badge-orange-text)', fontWeight: 600 }}>
                            BS: {loan.supplementCount} lần
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '30px 10px',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    fontStyle: 'italic',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                  }}
                >
                  Không có hồ sơ trong công đoạn này
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
