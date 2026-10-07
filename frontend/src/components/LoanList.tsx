import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { LoanApplication } from '../types';
import { useAuth } from '../context/AuthContext';
import { KanbanBoard } from './KanbanBoard';
import {
  Search,
  Filter,
  Plus,
  ChevronRight,
  RefreshCw,
  LayoutGrid,
  List,
} from 'lucide-react';

interface LoanListProps {
  onSelectLoan: (loanId: string) => void;
  onOpenCreate: () => void;
}

export const LoanList: React.FC<LoanListProps> = ({ onSelectLoan, onOpenCreate }) => {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban'); // Mặc định là Kanban Board theo yêu cầu
  const [keyword, setKeyword] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [myOnly, setMyOnly] = useState(false);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (stageFilter) params.append('stage', stageFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (myOnly) params.append('myOnly', 'true');

      const data = await api.get<LoanApplication[]>(`/loan-applications?${params.toString()}`);
      setLoans(data);
    } catch (err: any) {
      console.error('Lỗi tải danh sách hồ sơ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [stageFilter, statusFilter, myOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLoans();
  };

  const formatVnd = (num?: number | string | null) => {
    if (!num) return '0 VNĐ';
    return `${Number(num).toLocaleString('vi-VN')} VNĐ`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="badge badge-soft-green">🟢 Đã phê duyệt</span>;
      case 'REJECTED':
        return <span className="badge badge-soft-red">🔴 Bị từ chối</span>;
      case 'SUPPLEMENT_REQUIRED':
        return <span className="badge badge-soft-orange">🟡 Chờ bổ sung (Tạm dừng SLA)</span>;
      case 'PENDING_APPRAISAL':
        return <span className="badge badge-soft-amber">🟡 Đang thẩm định</span>;
      case 'WAITING_HEAD_OFFICE':
        return <span className="badge badge-soft-purple">🟣 Chờ Cấp trên duyệt</span>;
      case 'CHECKED':
        return <span className="badge badge-soft-blue">🔵 Đã đủ hồ sơ</span>;
      default:
        return <span className="badge badge-soft-blue">🔵 Mới tiếp nhận</span>;
    }
  };

  return (
    <div>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Quản lý Quy trình Hồ sơ Vay vốn SME
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Theo dõi tiến trình hồ sơ qua luồng công việc và cảnh báo sớm nguy cơ trễ hạn SLA
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Nút chuyển đổi View Mode: Kanban vs Table */}
          <div
            style={{
              display: 'flex',
              background: '#ffffff',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              onClick={() => setViewMode('kanban')}
              className="btn"
              style={{
                padding: '6px 12px',
                background: viewMode === 'kanban' ? 'var(--primary-light)' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '12px',
              }}
            >
              <LayoutGrid size={14} /> Kanban Board
            </button>
            <button
              onClick={() => setViewMode('table')}
              className="btn"
              style={{
                padding: '6px 12px',
                background: viewMode === 'table' ? 'var(--primary-light)' : 'transparent',
                color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '12px',
              }}
            >
              <List size={14} /> Danh sách bảng
            </button>
          </div>

          <button onClick={fetchLoans} className="btn btn-secondary">
            <RefreshCw size={15} /> Làm mới
          </button>

          <button onClick={onOpenCreate} className="btn btn-primary">
            <Plus size={16} /> Tạo hồ sơ vay mới
          </button>
        </div>
      </div>

      {/* Filter & Search Bar Sáng Sủa */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: '#ffffff',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm theo Mã hồ sơ, Tên doanh nghiệp, MST..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: '100%', paddingLeft: 32 }}
            />
          </div>
          <button type="submit" className="btn btn-secondary" style={{ padding: '8px 14px' }}>
            Tìm
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={15} color="var(--text-muted)" />
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="">Tất cả công đoạn</option>
            <option value="TIEP_NHAN">1. Tiếp nhận hồ sơ</option>
            <option value="THAM_DINH">2. Thẩm định tín dụng</option>
            <option value="CAP_TREN">3. Hội đồng / Cấp trên</option>
            <option value="HOAN_TAT">4. Hoàn tất & Phê duyệt</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="RECEIVED">Mới tiếp nhận</option>
            <option value="CHECKED">Đã đủ hồ sơ</option>
            <option value="SUPPLEMENT_REQUIRED">Chờ bổ sung (Tạm dừng SLA)</option>
            <option value="PENDING_APPRAISAL">Đang thẩm định</option>
            <option value="WAITING_HEAD_OFFICE">Chờ Cấp trên duyệt</option>
            <option value="APPROVED">Đã phê duyệt</option>
            <option value="REJECTED">Bị từ chối</option>
          </select>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '13px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              marginLeft: 8,
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={myOnly}
              onChange={(e) => setMyOnly(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Chỉ hồ sơ của tôi
          </label>
        </div>
      </div>

      {/* Hiển thị Chế độ KANBAN BOARD hoặc TABLE */}
      {viewMode === 'kanban' ? (
        <KanbanBoard loans={loans} onSelectLoan={onSelectLoan} />
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã hồ sơ</th>
                <th>Doanh nghiệp & Ngành nghề</th>
                <th>Số tiền vay</th>
                <th>Công đoạn</th>
                <th>Trạng thái</th>
                <th>Nguy cơ trễ hạn (AI)</th>
                <th>Cán bộ phụ trách</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Đang tải dữ liệu hồ sơ...
                  </td>
                </tr>
              ) : loans.length > 0 ? (
                loans.map((loan) => {
                  const latestPred = loan.delayPredictions?.[0];

                  return (
                    <tr key={loan.id} style={{ cursor: 'pointer' }} onClick={() => onSelectLoan(loan.id)}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                          {loan.applicationCode}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(loan.createdAt).toLocaleDateString('vi-VN')}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600 }}>{loan.company.companyName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          MST: {loan.company.taxCode} • {loan.company.industry}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: '#0369a1', fontFamily: 'var(--font-mono)' }}>
                          {formatVnd(loan.officialAmount || loan.proposedAmount)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {loan.loanTermMonths} tháng • {loan.loanType}
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-soft-gray">{loan.currentStage}</span>
                      </td>

                      <td>{getStatusBadge(loan.currentStatus)}</td>

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
                            {latestPred.riskLevel === 'CAO' ? '⚠️ ' : ''}
                            {latestPred.riskLevel} ({(latestPred.delayProbability * 100).toFixed(0)}%)
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chưa dự báo</span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>
                          {loan.assignedUser?.fullName || 'Chưa gán'}
                        </div>
                      </td>

                      <td>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLoan(loan.id);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        >
                          Chi tiết <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Không tìm thấy hồ sơ nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
