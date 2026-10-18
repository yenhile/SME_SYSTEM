import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, RoleCode } from '../types';
import { api, getAuthToken, setAuthToken, setActiveRole } from '../api/client';
interface AuthContextType {
  user: User | null; loading: boolean; sessionError: string; activeRole: RoleCode | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void; selectRole: (role: RoleCode) => void;
  hasRole: (role: RoleCode) => boolean; restoreSession: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const ROLE_NAMES: Record<RoleCode, string> = {
  ADMIN: 'Quản trị hệ thống', CBTD: 'Cán bộ tín dụng', THAM_QUYEN: 'Cán bộ thẩm quyền', QUAN_LY: 'Quản lý chi nhánh',
};
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, updateRole] = useState<RoleCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const logout = () => {
    setAuthToken(null); setActiveRole(null); setUser(null); updateRole(null); setSessionError('');
    ['sme_demo_actor', 'sme_current_user'].forEach(key => localStorage.removeItem(key));
  };
  const acceptUser = (profile: User) => {
    if (!profile.roles.length) throw new Error('Tài khoản chưa được cấp vai trò. Vui lòng liên hệ quản trị viên.');
    const saved = localStorage.getItem('sme_active_role') as RoleCode;
    const role = profile.roles.includes(saved) ? saved : profile.roles[0];
    setActiveRole(role); updateRole(role); setUser(profile); setSessionError('');
  };
  const restoreSession = async () => {
    setLoading(true); setSessionError('');
    try { if (getAuthToken()) acceptUser(await api.get<User>('/auth/me')); }
    catch (err) { setUser(null); setSessionError((err as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void restoreSession();
    const expired = () => logout();
    const sync = (event: StorageEvent) => { if (event.key === 'sme_token') logout(); };
    window.addEventListener('sme-session-expired', expired);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('sme-session-expired', expired); window.removeEventListener('storage', sync); };
  }, []);
  const login = async (username: string, password: string) => {
    const result = await api.post<{ accessToken: string; user: User }>('/auth/login', { username, password });
    acceptUser(result.user); setAuthToken(result.accessToken);
  };
  const selectRole = (role: RoleCode) => {
    if (user?.roles.includes(role)) { setActiveRole(role); updateRole(role); }
  };
  return <AuthContext.Provider value={{ user, loading, sessionError, activeRole, login, logout, selectRole, hasRole: role => activeRole === role, restoreSession }}>{children}</AuthContext.Provider>;
};
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
