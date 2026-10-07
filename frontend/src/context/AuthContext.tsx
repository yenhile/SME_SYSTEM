import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleCode } from '../types';
import { api, setAuthToken, getAuthToken } from '../api/client';
import { DEMO_USERS } from '../mockData';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password?: string) => Promise<void>;
  logout: () => void;
  quickSwitch: (username: string) => Promise<void>;
  hasRole: (role: RoleCode) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SAMPLE_USERS = [
  {
    username: 'cbtd_nam',
    name: 'Nguyễn Văn Nam',
    role: 'CBTD',
    desc: 'Tiếp nhận hồ sơ, kiểm tra chứng từ, gửi yêu cầu bổ sung & chuyển thẩm định',
  },
  {
    username: 'risk_quang',
    name: 'Trần Thị Quang',
    role: 'THAM_QUYEN',
    desc: 'Thẩm định hồ sơ, xem AI giải thích rủi ro, định mức & phê duyệt/từ chối',
  },
  {
    username: 'manager_dung',
    name: 'Lê Hoàng Dũng',
    role: 'QUAN_LY',
    desc: 'Giám sát KPI & SLA chi nhánh, phát hiện điểm nghẽn và điều chuyển cán bộ',
  },
  {
    username: 'admin',
    name: 'Quản trị viên Hệ thống',
    role: 'ADMIN',
    desc: 'Quản trị người dùng, cấu hình SLA và toàn quyền hệ thống',
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục phiên đăng nhập khi load trang
  useEffect(() => {
    const initAuth = async () => {
      const savedUsername = localStorage.getItem('sme_demo_actor') || 'cbtd_nam';
      const currentUser = DEMO_USERS[savedUsername] || DEMO_USERS['cbtd_nam'];
      setUser(currentUser);
      localStorage.setItem('sme_current_user', JSON.stringify(currentUser));
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password = 'password123') => {
    setLoading(true);
    try {
      const res = await api.post<{ accessToken: string; user: User }>('/auth/login', {
        username,
        password,
      });
      setAuthToken(res.accessToken);
      const selected = res.user || DEMO_USERS[username] || DEMO_USERS['cbtd_nam'];
      setUser(selected);
      localStorage.setItem('sme_demo_actor', username);
      localStorage.setItem('sme_current_user', JSON.stringify(selected));
    } catch {
      // Fallback
      const selected = DEMO_USERS[username] || DEMO_USERS['cbtd_nam'];
      setUser(selected);
      localStorage.setItem('sme_demo_actor', username);
      localStorage.setItem('sme_current_user', JSON.stringify(selected));
    } finally {
      setLoading(false);
    }
  };

  const quickSwitch = async (username: string) => {
    await login(username, 'password123');
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('sme_demo_actor');
    localStorage.removeItem('sme_current_user');
  };

  const hasRole = (role: RoleCode): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, quickSwitch, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
};
