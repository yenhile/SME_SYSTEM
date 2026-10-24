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
function Workspace() {
  const { activeRole } = useAuth();
  const [tab, setTab] = useState<Tab>(getDefaultTab);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [revision, setRevision] = useState(0);
  const [intakeTarget, setIntakeTarget] = useState<{ id: string; revision: number } | null>(null);
  const refresh = () => setRevision(value => value + 1);
  const activeTab = resolveTab(tab);
  return <div className="app-container"><Navbar activeTab={activeTab} onTabChange={setTab} onOpenIntake={id => { setSelectedLoanId(null); setTab('loans'); setIntakeTarget(previous => ({ id, revision: (previous?.revision ?? 0) + 1 })); }} /><main className="main-content">
    {(activeTab === 'loans' || activeTab === 'appraisal') && <LoanList key={activeTab} scope={activeTab === 'appraisal' ? 'appraisal' : 'all'} intakeTarget={intakeTarget} refreshKey={revision} onSelectLoan={setSelectedLoanId} onOpenCreate={() => setShowCreate(true)} />}
    {activeTab === 'companies' && <CompaniesView />}
    {activeTab === 'dashboard' && <DashboardView onSelectLoan={setSelectedLoanId} onGoToAssignments={() => setTab('assignments')} />}
    {activeTab === 'assignments' && <AssignmentsView />}
    {activeTab === 'users' && <AdminView section="users" />}
    {activeTab === 'settings' && <AdminView section="settings" />}
  </main>
    {showCreate && activeRole === 'CBTD' && <CreateLoanModal isOpen onClose={() => setShowCreate(false)} onSuccess={refresh} />}
    {selectedLoanId && <LoanDetailModal applicationId={selectedLoanId} onClose={() => setSelectedLoanId(null)} onRefresh={refresh} />}
  </div>;
}
function AppContent() {
  const { user, loading, activeRole } = useAuth();
  if (loading) return <main className="login-page">Đang kiểm tra phiên đăng nhập…</main>;
  if (!user) return <LoginPage />;
  return <Workspace key={`${user.id}:${activeRole}`} />;
}
export default function App() { return /^\/portal(?:\/|$)/.test(window.location.pathname) ? <PortalApp /> : <AuthProvider><AppContent /></AuthProvider>; }
