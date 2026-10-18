import { useAuth, ROLE_NAMES } from '../context/AuthContext';
import { RoleCode } from '../types';
import { FileText, BarChart3, Users, Landmark, LogOut, Settings, Building2 } from 'lucide-react';
export type Tab = 'loans' | 'dashboard' | 'assignments' | 'companies' | 'users' | 'settings';
export const NAV_ITEMS = [
  { tab: 'loans' as Tab, label: 'Hồ sơ vay vốn', icon: FileText, roles: ['CBTD', 'THAM_QUYEN', 'QUAN_LY'] },
  { tab: 'companies' as Tab, label: 'Doanh nghiệp', icon: Building2, roles: ['CBTD', 'THAM_QUYEN', 'QUAN_LY'] },
  { tab: 'dashboard' as Tab, label: 'Giám sát SLA & AI', icon: BarChart3, roles: ['QUAN_LY', 'THAM_QUYEN'] },
  { tab: 'assignments' as Tab, label: 'Điều chuyển & Tải CBTD', icon: Users, roles: ['QUAN_LY'] },
  { tab: 'users' as Tab, label: 'Tài khoản & Phân quyền', icon: Users, roles: ['ADMIN'] },
  { tab: 'settings' as Tab, label: 'Cấu hình SLA', icon: Settings, roles: ['ADMIN'] },
];
export function Navbar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  const { user, activeRole, selectRole, logout } = useAuth();
  return <aside className="sidebar">
    <div className="brand-section"><div className="brand-icon"><Landmark size={22} /></div><strong>SME LOAN<br />WORKFLOW</strong></div>
    <p className="sidebar-caption">{activeRole === 'ADMIN' ? 'QUẢN TRỊ HỆ THỐNG' : 'NGHIỆP VỤ TÍN DỤNG'}</p>
    <nav aria-label="Menu chính">{NAV_ITEMS.filter(item => item.roles.includes(activeRole || '')).map(item => <button key={item.tab} className={`nav-tab-btn ${activeTab === item.tab ? 'active' : ''}`} onClick={() => onTabChange(item.tab)}><item.icon size={18} />{item.label}</button>)}</nav>
    <div className="sidebar-account"><strong>{user?.fullName}</strong><p>{user?.username}</p>
      <label>Vai trò đang dùng<select aria-label="Vai trò đang dùng" value={activeRole || ''} onChange={e => selectRole(e.target.value as RoleCode)}>{user?.roles.map(role => <option key={role} value={role}>{ROLE_NAMES[role]}</option>)}</select></label>
      <button className="btn btn-secondary" onClick={logout}><LogOut size={16} />Đăng xuất</button>
    </div>
  </aside>;
}
