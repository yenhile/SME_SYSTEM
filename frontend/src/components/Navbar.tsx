import React, { useState } from 'react';
import { useAuth, SAMPLE_USERS } from '../context/AuthContext';
import { FileText, BarChart3, Users, Landmark, LogOut, ShieldCheck, Zap, UserCheck } from 'lucide-react';
import { LoginModal } from './LoginModal';

interface NavbarProps {
  activeTab: 'loans' | 'dashboard' | 'assignments';
  onTabChange: (tab: 'loans' | 'dashboard' | 'assignments') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const { user, logout, quickSwitch } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const getRoleDisplayName = (roles: string[] = []) => {
    if (roles.includes('ADMIN')) return 'Quản trị viên (Admin)';
    if (roles.includes('QUAN_LY')) return 'Quản lý chi nhánh';
    if (roles.includes('THAM_QUYEN')) return 'Cán bộ thẩm quyền';
    return 'Cán bộ tín dụng (CBTD)';
  };

  return (
    <>
      <header className="navbar">
        {/* Brand Logo */}
        <div className="brand-section">
          <div className="brand-icon">
            <Landmark size={22} />
          </div>
          <div className="brand-text">
            <h1>SME LOAN WORKFLOW</h1>
            <p>Hệ thống xét duyệt tín dụng SME & Cảnh báo trễ hạn SLA</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="nav-center">
          <button
            className={`nav-tab-btn ${activeTab === 'loans' ? 'active' : ''}`}
            onClick={() => onTabChange('loans')}
          >
            <FileText size={16} />
            Hồ sơ vay vốn
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
          >
            <BarChart3 size={16} />
            Giám sát SLA & AI
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => onTabChange('assignments')}
          >
            <Users size={16} />
            Điều chuyển & Tải CBTD
          </button>
        </div>

        {/* User Section & Quick Switcher */}
        <div className="user-section">
          <button
            onClick={() => setShowLoginModal(true)}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <UserCheck size={14} color="#0284c7" />
            <span>Đổi Actor (4 vai trò)</span>
          </button>

          <div className="quick-switcher">
            <Zap size={14} color="#f59e0b" />
            <select
              value={user?.username || ''}
              onChange={(e) => quickSwitch(e.target.value)}
              style={{ padding: '3px 8px', fontSize: '12px', border: 'none', background: 'transparent', fontWeight: 600 }}
            >
              {SAMPLE_USERS.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.role} - {u.name}
                </option>
              ))}
            </select>
          </div>

          {user && (
            <div className="user-badge">
              <div className="user-avatar">{user.fullName.charAt(0)}</div>
              <div className="user-info">
                <div className="user-name">{user.fullName}</div>
                <div className="user-role">
                  <ShieldCheck size={11} style={{ display: 'inline', marginRight: 3 }} />
                  {getRoleDisplayName(user.roles)}
                </div>
              </div>
              <button
                onClick={logout}
                title="Đăng xuất"
                className="btn btn-secondary"
                style={{ padding: '6px 10px', marginLeft: 4 }}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  );
};
