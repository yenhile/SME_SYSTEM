import { useEffect, useRef, useState } from 'react';
import { useAuth, ROLE_NAMES } from '../context/AuthContext';
import { BarChart3, Landmark, LogOut, Settings, FolderOpen, History, ChevronDown, CircleUserRound, Languages, CircleHelp, ShieldCheck } from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS, type Tab } from '../navigation';
import { NotificationBell } from './NotificationBell';
const groupIcons = { overview: BarChart3, operations: Settings, loans: FolderOpen, system: History };
const accountItems = [
  { label: 'Hồ sơ', icon: CircleUserRound },
  { label: 'Cài đặt', icon: Settings },
  { label: 'Ngôn ngữ', icon: Languages },
  { label: 'Trợ giúp', icon: CircleHelp, divider: true },
  { label: 'Quyền riêng tư', icon: ShieldCheck },
];
export function Navbar({ activeTab, onTabChange, onOpenIntake }: { activeTab: Tab; onTabChange: (tab: Tab) => void; onOpenIntake: (id: string) => void }) {
  const { user, activeRole, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const displayName = user?.fullName || user?.username || '';
  const initial = displayName.trim().split(/\s+/).at(-1)?.charAt(0).toLocaleUpperCase('vi-VN') || 'U';
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
  return <><aside className="sidebar">
    <div className="brand-section"><div className="brand-icon"><Landmark size={22} /></div><strong>SME LOAN<br />WORKFLOW</strong></div>
    <nav aria-label="Menu chính" className="grouped-navigation">{NAV_GROUPS.map(group => {
      const items = NAV_ITEMS.filter(item => item.group === group.id);
      if (!items.length) return null;
      const Icon = groupIcons[group.id];
      return <section className="nav-group" key={group.id} aria-labelledby={`nav-group-${group.id}`}>
        <h2 id={`nav-group-${group.id}`} className="nav-group-heading"><Icon size={18} />{group.label}</h2>
        <div className="nav-group-items">{items.map(item => <button key={item.tab} data-tab={item.tab} disabled={item.unavailable} title={item.unavailable ? `${item.label}: chức năng chưa triển khai.` : undefined} aria-current={activeTab === item.tab ? 'page' : undefined} className={`nav-tab-btn ${activeTab === item.tab ? 'active' : ''}`} onClick={() => onTabChange(item.tab)}><span>{item.label}</span>{item.unavailable && <small>Chưa triển khai</small>}</button>)}</div>
      </section>;
    })}</nav>
  </aside>
  <header className="workspace-header">
    <NotificationBell onOpenIntake={onOpenIntake} />
    <div className="account-control" ref={accountRef} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAccountOpen(false);
    }}>
      <button className="account-trigger" ref={triggerRef} type="button" aria-label="Mở tài khoản và vai trò" aria-haspopup="dialog" aria-expanded={accountOpen} aria-controls={accountOpen ? 'account-popup' : undefined} onClick={() => setAccountOpen(open => !open)}>
        <span className="account-avatar" aria-hidden="true">{initial}</span>
        <span className="account-trigger-text"><strong>{displayName}</strong><span>{activeRole ? ROLE_NAMES[activeRole] : ''}</span></span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {accountOpen && <div id="account-popup" className="account-popup" role="dialog" aria-label="Tài khoản" tabIndex={-1} ref={popupRef}>
        <div className="account-popup-summary"><span className="account-avatar" aria-hidden="true">{initial}</span><strong>{displayName}</strong><span className="account-role-badge">{activeRole ? ROLE_NAMES[activeRole] : ''}</span><p>{user?.username}</p></div>
        <div className="account-menu-items">{accountItems.map(item => <button key={item.label} type="button" className={`account-menu-item${item.divider ? ' account-menu-divider' : ''}`} disabled title={`${item.label}: chưa thiết lập chức năng.`}><item.icon size={18} aria-hidden="true" />{item.label}</button>)}</div>
        <button className="account-logout" type="button" onClick={logout}><LogOut size={18} />Đăng xuất</button>
      </div>}
    </div>
  </header></>;
}
