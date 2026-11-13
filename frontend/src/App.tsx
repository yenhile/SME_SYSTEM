import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { canOpenTab, getDefaultTab, resolveTab, type Tab } from './navigation';
import { appraisalPath, appraisalRefFromPath, isLookupAddress, lookupAppraisalPath } from './appraisalWorkspace';
import { LEAVE_WARNING, officerCasePath, officerCaseRefFromPath } from './officerCase';
import { AppraisalWorkspace } from './components/AppraisalWorkspace';
import { OfficerCaseWorkspace } from './components/OfficerCaseWorkspace';
import { LoginPage } from './components/LoginPage';
import { LoanList } from './components/LoanList';
import { AppraisalQueue } from './components/AppraisalQueue';
import { DashboardView } from './components/DashboardView';
import { MyWarningsPanel } from './components/MyWarningsPanel';
import { AccountPage } from './components/AccountPage';
import type { AccountPageKind } from './components/AccountDialogs';
import { AssignmentsView } from './components/AssignmentsView';
import { CreateLoanModal } from './components/CreateLoanModal';
import { LoanDetailModal } from './components/LoanDetailModal';
import { AdminView } from './components/AdminView';
import { InterestRateBandsView } from './components/InterestRateBandsView';
import { AdminActivityLog } from './components/AdminActivityLog';
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
  const [accountPage, setAccountPage] = useState<AccountPageKind | null>(null);
  const [revision, setRevision] = useState(0);
  const [intakeTarget, setIntakeTarget] = useState<{ id: string; revision: number } | null>(null);
  const isAuthority = activeRole === 'THAM_QUYEN';
  const [appraisalRef, setAppraisalRef] = useState<string | null>(() => isAuthority ? appraisalRefFromPath(window.location.pathname) : null);
  const [lookup, setLookup] = useState(() => isLookupAddress(window.location.search));
  const isOfficer = activeRole === 'CBTD';
  const [caseRef, setCaseRef] = useState<string | null>(() => isOfficer ? officerCaseRefFromPath(window.location.pathname) : null);
  const caseDirty = useRef(false);
  const shownCase = useRef(caseRef);
  const listScroll = useRef(0);
  shownCase.current = caseRef;

  const confirmLeave = useCallback(() => !caseDirty.current || window.confirm(LEAVE_WARNING), []);
  const markCaseDirty = useCallback((dirty: boolean) => { caseDirty.current = dirty; }, []);
  const restoreListScroll = () => requestAnimationFrame(() => window.scrollTo({ top: listScroll.current }));

  useEffect(() => {
    const { pathname } = window.location;
    if ((!isAuthority && appraisalRefFromPath(pathname)) || (!isOfficer && officerCaseRefFromPath(pathname))) window.history.replaceState(null, '', '/');
    if (isAuthority) {
      const followAddress = () => {
        setAppraisalRef(appraisalRefFromPath(window.location.pathname));
        setLookup(isLookupAddress(window.location.search));
      };
      window.addEventListener('popstate', followAddress);
      return () => window.removeEventListener('popstate', followAddress);
    }
    if (isOfficer) {
      const followAddress = () => {
        const next = officerCaseRefFromPath(window.location.pathname);
        if (next === shownCase.current) return;
        if (!confirmLeave()) {
          if (shownCase.current) window.history.pushState(null, '', officerCasePath(shownCase.current));
          return;
        }
        if (!shownCase.current) listScroll.current = window.scrollY;
        setCaseRef(next);
        if (!next) { setRevision(value => value + 1); restoreListScroll(); }
      };
      window.addEventListener('popstate', followAddress);
      return () => window.removeEventListener('popstate', followAddress);
    }
  }, [isAuthority, isOfficer, confirmLeave]);

  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const showAppraisalCode = useCallback((applicationCode: string) => {
    const target = appraisalPath(applicationCode);
    if (appraisalRefFromPath(window.location.pathname) && window.location.pathname !== target) window.history.replaceState(null, '', `${target}${window.location.search}`);
  }, []);
  const showCaseCode = useCallback((applicationCode: string) => {
    const target = officerCasePath(applicationCode);
    if (officerCaseRefFromPath(window.location.pathname) && window.location.pathname !== target) window.history.replaceState(null, '', target);
  }, []);

  const openOfficerCase = (loanId: string) => {
    if (loanId === caseRef) { refresh(); return; }
    if (!confirmLeave()) return;
    if (!caseRef) listScroll.current = window.scrollY;
    window.history.pushState(null, '', officerCasePath(loanId));
    setCaseRef(loanId);
  };
  const openLoan = (loanId: string) => {
    if (isOfficer) { openOfficerCase(loanId); return; }
    if (!isAuthority) { setSelectedLoanId(loanId); return; }
    window.history.pushState(null, '', appraisalPath(loanId));
    setLookup(false);
    setAppraisalRef(loanId);
  };
  const openLoanForLookup = (loanId: string) => {
    if (isOfficer) { openOfficerCase(loanId); return; }
    if (!isAuthority) { setSelectedLoanId(loanId); return; }
    window.history.pushState(null, '', lookupAppraisalPath(loanId));
    setLookup(true);
    setAppraisalRef(loanId);
  };
  const leaveAppraisal = () => {
    if (appraisalRefFromPath(window.location.pathname) || officerCaseRefFromPath(window.location.pathname)) window.history.pushState(null, '', '/');
    setLookup(false);
    setAppraisalRef(null);
    setCaseRef(null);
  };
  const openAccountPage = (kind: AccountPageKind) => {
    if (!confirmLeave()) return;
    setAccountPage(kind);
  };
  const changeTab = (next: Tab) => {
    if (!confirmLeave()) return false;
    const leavingCase = Boolean(caseRef);
    leaveAppraisal();
    setAccountPage(null);
    setTab(next);
    if (leavingCase) { refresh(); restoreListScroll(); }
    return true;
  };

  const openCase = (subject: { type: 'LOAN' | 'PORTAL'; id: string }) => {
    setCoordinationId(null);
    if (subject.type === 'LOAN') openLoan(subject.id);
    else {
      setSelectedLoanId(null);
      setTab('loans');
      setIntakeTarget(previous => ({ id: subject.id, revision: (previous?.revision ?? 0) + 1 }));
    }
  };

  const activeTab = caseRef ? 'loans' : appraisalRef ? (lookup ? 'loans' : 'appraisal') : resolveTab(tab, activeRole);

  return (
    <div className="app-container" data-role={activeRole}>
      <Navbar
        activeTab={accountPage ? ('' as Tab) : activeTab}
        onTabChange={changeTab}
        onOpenAccountPage={openAccountPage}
        onOpenIntake={id => {
          setSelectedLoanId(null);
          if (!changeTab('loans')) return;
          setIntakeTarget(previous => ({ id, revision: (previous?.revision ?? 0) + 1 }));
        }}
        onOpenLoan={openLoan}
        confirmLeave={confirmLeave}
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
              fontWeight: 600,
              lineHeight: 1,
            }}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}

      <main className="main-content">
        {accountPage && <AccountPage kind={accountPage} onBack={() => setAccountPage(null)} />}
        <div hidden={Boolean(accountPage)}>
        {appraisalRef ? (
          <AppraisalWorkspace key={appraisalRef} reference={appraisalRef} lookup={lookup} onOpenForReview={openLoan} onBack={() => changeTab(lookup || tab === 'loans' ? 'loans' : 'appraisal')} onChanged={refresh} onResolved={showAppraisalCode} />
        ) : activeTab === 'loans' && (
          <div hidden={Boolean(caseRef)}>
            <LoanList
              priority={isOfficer && <MyWarningsPanel refreshKey={revision} onSelectLoan={openLoanForLookup} />}
              intakeTarget={intakeTarget}
              refreshKey={revision}
              onSelectLoan={openLoanForLookup}
              onOpenCreate={() => setShowCreate(true)}
            />
          </div>
        )}
        {caseRef && <OfficerCaseWorkspace key={caseRef} reference={caseRef} refreshKey={revision} onBack={() => changeTab(tab)} onResolved={showCaseCode} onDirtyChange={markCaseDirty} />}
        {!appraisalRef && !caseRef && activeTab === 'appraisal' && <AppraisalQueue refreshKey={revision} onSelectLoan={openLoan} />}
        {!appraisalRef && activeTab === 'companies' && <CompaniesView />}
        {!appraisalRef && activeTab === 'dashboard' && <DashboardView onSelectLoan={openLoan} onOpenTab={next => { if (canOpenTab(next, activeRole)) setTab(next); }} onGoToAssignments={activeRole === 'QUAN_LY' ? () => setTab('assignments') : undefined} />}
        {activeTab === 'assignments' && <AssignmentsView onOpenCase={openCase} />}
        {activeTab === 'users' && <AdminView section="users" />}
        {activeTab === 'settings' && <AdminView section="settings" />}
        {activeTab === 'rates' && <InterestRateBandsView />}
        {activeTab === 'activity' && <AdminActivityLog />}
        </div>
      </main>

      {showCreate && activeRole === 'CBTD' && <CreateLoanModal isOpen onClose={() => setShowCreate(false)} onSuccess={refresh} />}
      {selectedLoanId && <LoanDetailModal applicationId={selectedLoanId} onClose={() => { setSelectedLoanId(null); refresh(); }} onRefresh={refresh} />}
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
