import React from 'react';
import { useAuth } from '../context/AuthContext';
import type { Tab } from '../navigation';
import { AdminDashboard } from './dashboard/AdminDashboard';
import { ApproverDashboard } from './dashboard/ApproverDashboard';
import { ManagerDashboard } from './dashboard/ManagerDashboard';
import { OfficerDashboard } from './dashboard/OfficerDashboard';
import './loan-table.css';
import './operations-dashboard.css';

interface DashboardViewProps {
  onSelectLoan: (loanId: string) => void;
  /** Chỉ truyền khi vai trò đang dùng được điều phối (Quản lý chi nhánh). */
  onGoToAssignments?: () => void;
  onOpenTab?: (tab: Tab) => void;
}

/** Mỗi vai trò có dashboard riêng, đọc API riêng theo phạm vi do backend giới hạn; không dùng chung một màn rồi ẩn bớt. */
export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectLoan, onGoToAssignments, onOpenTab }) => {
  const { activeRole } = useAuth();
  return (
    <div className="dashboard-view ops" key={activeRole ?? 'none'}>
      {activeRole === 'ADMIN' && <AdminDashboard onOpenTab={onOpenTab} />}
      {activeRole === 'QUAN_LY' && <ManagerDashboard onSelectLoan={onSelectLoan} onGoToAssignments={onGoToAssignments} />}
      {activeRole === 'CBTD' && <OfficerDashboard onSelectLoan={onSelectLoan} />}
      {activeRole === 'THAM_QUYEN' && <ApproverDashboard onSelectLoan={onSelectLoan} />}
    </div>
  );
};
