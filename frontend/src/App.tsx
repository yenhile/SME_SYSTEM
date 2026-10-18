import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar, NAV_ITEMS, Tab } from './components/Navbar';
import { LoginPage } from './components/LoginPage';
import { LoanList } from './components/LoanList';
import { DashboardView } from './components/DashboardView';
import { AssignmentsView } from './components/AssignmentsView';
import { CreateLoanModal } from './components/CreateLoanModal';
import { LoanDetailModal } from './components/LoanDetailModal';
import { AdminView } from './components/AdminView';
import { CompaniesView } from './components/CompaniesView';
function Workspace() {
  const { activeRole } = useAuth();
  const [tab, setTab] = useState<Tab>(activeRole === 'ADMIN' ? 'users' : 'loans');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision(value => value + 1);
  const activeTab = NAV_ITEMS.some(item => item.tab === tab && item.roles.includes(activeRole || '')) ? tab : activeRole === 'ADMIN' ? 'users' : 'loans';
  return <div className="app-container"><Navbar activeTab={activeTab} onTabChange={setTab} /><main className="main-content">
    {activeTab === 'loans' && <LoanList refreshKey={revision} onSelectLoan={setSelectedLoanId} onOpenCreate={() => setShowCreate(true)} />}
    {activeTab === 'companies' && <CompaniesView />}
    {activeTab === 'dashboard' && <DashboardView onSelectLoan={setSelectedLoanId} onGoToAssignments={activeRole === 'QUAN_LY' ? () => setTab('assignments') : undefined} />}
    {activeTab === 'assignments' && <AssignmentsView />}
    {(activeTab === 'users' || activeTab === 'settings') && <AdminView key={activeTab} section={activeTab} />}
  </main>
    {showCreate && activeRole === 'CBTD' && <CreateLoanModal isOpen onClose={() => setShowCreate(false)} onSuccess={refresh} />}
    {selectedLoanId && activeRole !== 'ADMIN' && <LoanDetailModal applicationId={selectedLoanId} onClose={() => setSelectedLoanId(null)} onRefresh={refresh} />}
  </div>;
}
function AppContent() {
  const { user, loading, activeRole } = useAuth();
  if (loading) return <main className="login-page">Đang kiểm tra phiên đăng nhập…</main>;
  if (!user) return <LoginPage />;
  return <Workspace key={`${user.id}:${activeRole}`} />;
}
export default function App() { return <AuthProvider><AppContent /></AuthProvider>; }
