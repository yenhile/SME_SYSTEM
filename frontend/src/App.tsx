import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoanList } from './components/LoanList';
import { DashboardView } from './components/DashboardView';
import { AssignmentsView } from './components/AssignmentsView';
import { CreateLoanModal } from './components/CreateLoanModal';
import { LoanDetailModal } from './components/LoanDetailModal';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'loans' | 'dashboard' | 'assignments'>('loans');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-main)',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
          SME LOAN WORKFLOW SYSTEM
        </div>
        <p style={{ fontSize: '13px' }}>Đang khởi tạo hệ thống xét duyệt tín dụng SME...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Thanh điều hướng Header */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Nội dung chính */}
      <main className="main-content" key={refreshKey}>
        {activeTab === 'loans' && (
          <LoanList
            onSelectLoan={(id) => setSelectedLoanId(id)}
            onOpenCreate={() => setShowCreateModal(true)}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            onSelectLoan={(id) => setSelectedLoanId(id)}
            onGoToAssignments={() => setActiveTab('assignments')}
          />
        )}

        {activeTab === 'assignments' && <AssignmentsView />}
      </main>

      {/* Modal Tiếp nhận hồ sơ mới */}
      <CreateLoanModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={triggerRefresh}
      />

      {/* Modal Xem chi tiết & Thao tác nghiệp vụ */}
      {selectedLoanId && (
        <LoanDetailModal
          applicationId={selectedLoanId}
          onClose={() => setSelectedLoanId(null)}
          onRefresh={triggerRefresh}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
