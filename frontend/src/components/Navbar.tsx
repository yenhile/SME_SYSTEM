import { useEffect, useRef, useState } from 'react';
import { useAuth, ROLE_NAMES } from '../context/AuthContext';
import { BarChart3, LogOut, Settings, FolderOpen, History, ChevronDown, CircleUserRound, Languages, CircleHelp, ShieldCheck, KeyRound } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { NAV_GROUPS, menuItems, type Tab } from '../navigation';
import { NotificationBell } from './NotificationBell';
import { ChangePasswordModal } from './ChangePasswordModal';
import { AccountDialog, type AccountDialogKind, type AccountPageKind } from './AccountDialogs';
import { RoleCode } from '../types';

const groupIcons = { overview: BarChart3, operations: Settings, loans: FolderOpen, system: History };
const accountItems: { kind: AccountPageKind | AccountDialogKind; label: string; icon: typeof Settings; divider?: boolean }[] = [
  { kind: 'profile', label: 'Hồ sơ', icon: CircleUserRound },
  { kind: 'settings', label: 'Cài đặt', icon: Settings },
  { kind: 'language', label: 'Ngôn ngữ', icon: Languages },
  { kind: 'help', label: 'Trợ giúp', icon: CircleHelp, divider: true },
  { kind: 'privacy', label: 'Quyền riêng tư', icon: ShieldCheck },
];

export function Navbar({ activeTab, onTabChange, onOpenAccountPage, onOpenIntake, onOpenLoan, onOpenCoordination, confirmLeave }: { activeTab: Tab; onTabChange: (tab: Tab) => void; onOpenAccountPage: (kind: AccountPageKind) => void; onOpenIntake: (id: string) => void; onOpenLoan: (id: string) => void; onOpenCoordination?: (id: string) => void; confirmLeave?: () => boolean }) {
  const { user, activeRole, selectRole, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [dialog, setDialog] = useState<AccountDialogKind | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const displayName = user?.fullName || user?.username || '';
  const initial = displayName.trim().split(/\s+/).at(-1)?.charAt(0).toLocaleUpperCase('vi-VN') || 'U';

  const handleSwitchRole = (newRole: RoleCode) => {
    if (newRole === activeRole) return;
    const confirmed = window.confirm(
      'Chuyển vai trò sẽ đóng các tác vụ đang mở và hủy bỏ mọi nội dung chưa lưu trên màn hình. Hệ thống không tự động lưu hoặc gửi thay bạn. Bạn có chắc chắn muốn chuyển vai trò?'
    );
    if (!confirmed) return;
    selectRole(newRole);
    setAccountOpen(false);
  };

  useEffect(() => {
    if (!accountOpen) return;
    popupRef.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [accountOpen]);

  return <>
    <aside className="sidebar">
      <div className="brand-section">
        <BrandLogo />
      </div>
      <nav aria-label="Menu chính" className="grouped-navigation">
        {NAV_GROUPS.map(group => {
          const items = menuItems(activeRole).filter(item => item.group === group.id);
          if (!items.length) return null;
          const Icon = groupIcons[group.id];
          const allLocked = items.every(item => item.access === 'locked');
          return <section className={`nav-group${allLocked ? ' all-locked' : ''}`} key={group.id} aria-labelledby={`nav-group-${group.id}`}>
            <h2 id={`nav-group-${group.id}`} className="nav-group-heading"><Icon size={18} />{group.label}</h2>
            <div className="nav-group-items">
              {items.map(item => {
                const locked = item.access === 'locked';
                return <button
                  key={item.tab}
                  data-tab={item.tab}
                  disabled={item.access === 'unavailable'}
                  aria-disabled={locked || undefined}
                  title={item.access === 'unavailable' ? `${item.label}: chức năng chưa triển khai.` : locked ? 'Vai trò của bạn không có quyền truy cập mục này.' : undefined}
                  aria-current={activeTab === item.tab ? 'page' : undefined}
                  className={`nav-tab-btn ${activeTab === item.tab ? 'active' : ''}${locked ? ' is-locked' : ''}`}
                  onClick={() => { if (!locked) onTabChange(item.tab); }}
                >
                  <span>{item.label}</span>
                  {locked && <span className="nav-sr-only">, không có quyền truy cập</span>}
                  {item.unavailable && <small>Chưa triển khai</small>}
                </button>;
              })}
            </div>
          </section>;
        })}
      </nav>
    </aside>

    <header className="workspace-header">
      <NotificationBell onOpenIntake={onOpenIntake} onOpenLoan={onOpenLoan} onOpenCoordination={onOpenCoordination} />
      <div
        className="account-control"
        ref={accountRef}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAccountOpen(false);
        }}
      >
        <button
          className="account-trigger"
          ref={triggerRef}
          type="button"
          aria-label="Mở tài khoản và vai trò"
          aria-haspopup="dialog"
          aria-expanded={accountOpen}
          aria-controls={accountOpen ? 'account-popup' : undefined}
          onClick={() => setAccountOpen(open => !open)}
        >
          <span className="account-avatar" aria-hidden="true">{initial}</span>
          <span className="account-trigger-text">
            <strong>{displayName}</strong>
            <span>{activeRole ? ROLE_NAMES[activeRole] : ''}</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>

        {accountOpen && (
          <div id="account-popup" className="account-popup" role="dialog" aria-label="Tài khoản" tabIndex={-1} ref={popupRef}>
            <div className="account-popup-summary">
              <span className="account-avatar" aria-hidden="true">{initial}</span>
              <strong>{displayName}</strong>
              <span className="account-role-badge">{activeRole ? ROLE_NAMES[activeRole] : ''}</span>
              <p>{user?.username}</p>
            </div>

            {/* D7-01: Bộ chọn vai trò làm việc khi tài khoản có nhiều hơn 1 vai trò */}
            {user && user.roles && user.roles.length > 1 && (
              <div className="account-role-switcher" role="radiogroup" aria-label="Chọn vai trò làm việc">
                <span
                  className="role-switcher-title"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    padding: '8px 12px 4px',
                    display: 'block',
                  }}
                >
                  Vai trò làm việc (R6)
                </span>
                <div className="role-switcher-list" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px 8px' }}>
                  {user.roles.map(r => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={activeRole === r}
                      data-role={r}
                      className={`role-option-btn ${activeRole === r ? 'active' : ''}`}
                      onClick={() => handleSwitchRole(r)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 4,
                        border: activeRole === r ? '1px solid var(--primary, #0284c7)' : '1px solid var(--border-color, #e2e8f0)',
                        background: activeRole === r ? 'var(--primary-subtle, #f0f9ff)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: activeRole === r ? 600 : 400,
                        color: activeRole === r ? 'var(--primary, #0284c7)' : 'inherit',
                      }}
                    >
                      <span>{ROLE_NAMES[r] || r}</span>
                      {activeRole === r && (
                        <span style={{ fontSize: '12px', color: 'var(--primary, #0284c7)' }}>● Đang dùng</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="account-menu-items">
              <button
                type="button"
                className="account-menu-item"
                onClick={() => { setAccountOpen(false); setChangePasswordOpen(true); }}
              >
                <KeyRound size={18} aria-hidden="true" />
                Đổi mật khẩu
              </button>
              {accountItems.map(item => (
                <button
                  key={item.kind}
                  type="button"
                  className={`account-menu-item${item.divider ? ' account-menu-divider' : ''}`}
                  onClick={() => { setAccountOpen(false); if (item.kind === 'language') setDialog(item.kind); else onOpenAccountPage(item.kind); }}
                >
                  <item.icon size={18} aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
            <button className="account-logout" type="button" onClick={() => { if (!confirmLeave || confirmLeave()) logout(); }}>
              <LogOut size={18} />
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>

    {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
    {dialog && <AccountDialog kind={dialog} onClose={() => setDialog(null)} />}
  </>;
}
