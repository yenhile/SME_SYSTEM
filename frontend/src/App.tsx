import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { getDefaultTab, resolveTab, type Tab } from './navigation';
import { LoginPage } from './components/LoginPage';
import { LoanList } from './components/LoanList';
import { DashboardView } from './components/DashboardView';
import { AssignmentsView } from './components/AssignmentsView';
import { CreateLoanModal } from './components/CreateLoanModal';
import { LoanDetailModal } from './components/LoanDetailModal';
import { AdminView } from './components/AdminView';
import { CompaniesView } from './components/CompaniesView';
import { PortalApp } from './portal/PortalApp';
import { AssignmentChangeRequestModal } from './components/AssignmentChangeRequestModal';
import { ShieldAlert } from 'lucide-react';

function Workspace() {
  const { activeRole, sessionNotice, clearSessionNotice } = useAuth();
  const [tab, setTab] = useState<Tab>(() => getDefaultTab(activeRole));
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [coordinationId, setCoordinationId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [revision, setRevision] = useState(0);
  const [intakeTarget, setIntakeTarget] = useState<{ id: string; revision: number } | null>(null);

  const refresh = () => setRevision(value => value + 1);

  const openCase = (subject: { type: 'LOAN' | 'PORTAL'; id: string }) => {
    setCoordinationId(null);
    if (subject.type === 'LOAN') setSelectedLoanId(subject.id);
    else {
      setSelectedLoanId(null);
      setTab('loans');
      setIntakeTarget(previous => ({ id: subject.id, revision: (previous?.revision ?? 0) + 1 }));
    }
  };

  const activeTab = resolveTab(tab, activeRole);

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        onTabChange={setTab}
        onOpenIntake={id => {
          setSelectedLoanId(null);
          setTab('loans');
          setIntakeTarget(previous => ({ id, revision: (previous?.revision ?? 0) + 1 }));
        }}
        onOpenLoan={setSelectedLoanId}
        onOpenCoordination={id => {
          setSelectedLoanId(null);
          setCoordinationId(id);
        }}
      />

      {/* D7-02 / D7-03: Hiển thị thông báo phục hồi vai trò / phiên trong Workspace */}
      {sessionNotice && (
        <div
          role="status"
          className="session-recovery-banner"
          style={{
            margin: '12px 24px 0',
            padding: '10px 16px',
            borderRadius: 8,
            background: 'var(--badge-amber-bg, #fef3c7)',
            border: '1px solid var(--badge-amber-border, #fcd34d)',
            color: 'var(--badge-amber-text, #92400e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={16} />
            <span>{sessionNotice}</span>
          </div>
          <button
            type="button"
            onClick={clearSessionNotice}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '2px 6px',
              fontSize: '16px',
              fontWeight: 'bold',
              lineHeight: 1,
            }}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}

      <main className="main-content">
        {(activeTab === 'loans' || activeTab === 'appraisal') && (
          <LoanList
            key={activeTab}
            scope={activeTab === 'appraisal' ? 'appraisal' : 'all'}
            intakeTarget={intakeTarget}
            refreshKey={revision}
            onSelectLoan={setSelectedLoanId}
            onOpenCreate={() => setShowCreate(true)}
          />
        )}
        {activeTab === 'companies' && <CompaniesView />}
        {activeTab === 'dashboard' && <DashboardView onSelectLoan={setSelectedLoanId} onGoToAssignments={() => setTab('assignments')} />}
        {activeTab === 'assignments' && <AssignmentsView onOpenCase={openCase} />}
        {activeTab === 'users' && <AdminView section="users" />}
        {activeTab === 'settings' && <AdminView section="settings" />}
      </main>

      {showCreate && activeRole === 'CBTD' && <CreateLoanModal isOpen onClose={() => setShowCreate(false)} onSuccess={refresh} />}
      {selectedLoanId && <LoanDetailModal applicationId={selectedLoanId} onClose={() => setSelectedLoanId(null)} onRefresh={refresh} />}
      {coordinationId && <AssignmentChangeRequestModal key={coordinationId} id={coordinationId} onClose={() => setCoordinationId(null)} onChanged={refresh} onOpenCase={openCase} />}
    </div>
  );
}

function AppContent() {
  const { user, loading, activeRole } = useAuth();
  if (loading) return <main className="login-page">Đang kiểm tra phiên đăng nhập…</main>;
  if (!user) return <LoginPage />;
  return <Workspace key={`${user.id}:${activeRole}`} />;
}

export default function App() {
  return /^\/portal(?:\/|$)/.test(window.location.pathname) ? <PortalApp /> : <AuthProvider><AppContent /></AuthProvider>;
}
