import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, RoleCode } from '../types';
import { api, getAuthToken, setAuthToken, setActiveRole, ApiError } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionError: string;
  sessionNotice: string;
  activeRole: RoleCode | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  selectRole: (role: RoleCode) => void;
  hasRole: (role: RoleCode) => boolean;
  restoreSession: () => Promise<void>;
  clearSessionNotice: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const ROLE_NAMES: Record<RoleCode, string> = {
  ADMIN: 'Quản trị hệ thống',
  CBTD: 'Cán bộ tín dụng',
  THAM_QUYEN: 'Cán bộ thẩm quyền',
  QUAN_LY: 'Quản lý chi nhánh',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, updateRole] = useState<RoleCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const recoveringRef = useRef(false);
  const sessionEpoch = useRef(0);

  const clearSessionNotice = () => setSessionNotice('');

  const logout = () => {
    sessionEpoch.current++;
    setAuthToken(null);
    setActiveRole(null);
    setUser(null);
    updateRole(null);
    setSessionError('');
    setSessionNotice('');
    setLoading(false);
    ['sme_demo_actor', 'sme_current_user', 'sme_active_role'].forEach(key => localStorage.removeItem(key));
  };

  const acceptUser = (profile: User) => {
    if (profile.isActive === false) {
      logout();
      setSessionError('Tài khoản đã bị tạm khóa, vui lòng liên hệ Quản trị viên.');
      return;
    }
    if (!profile.roles || !profile.roles.length) {
      logout();
      setSessionError('Tài khoản chưa được cấp vai trò nào. Vui lòng liên hệ quản trị viên.');
      return;
    }
    const saved = localStorage.getItem('sme_active_role') as RoleCode;
    const role = profile.roles.includes(saved) ? saved : profile.roles[0];
    setActiveRole(role);
    updateRole(role);
    setUser(profile);
    setSessionError('');
    setLoading(false);
  };

  const restoreSession = async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    const currentEpoch = ++sessionEpoch.current;
    setLoading(true);
    setSessionError('');
    try {
      const profile = await api.get<User>('/auth/me');
      // Nếu trong lúc chờ /auth/me phiên đã thay đổi (logout, login khác, đổi vai trò) -> bỏ qua phản hồi cũ
      if (sessionEpoch.current !== currentEpoch || getAuthToken() !== token) return;
      acceptUser(profile);
    } catch (err) {
      if (sessionEpoch.current !== currentEpoch || getAuthToken() !== token) return;
      const error = err as ApiError;
      // Lỗi mạng (0), timeout (408), lỗi server 5xx: KHÔNG kết luận tài khoản bị khóa, KHÔNG tự xóa phiên!
      if (error.status === 0 || error.status === 408 || error.status >= 500) {
        setSessionError('Không thể kết nối máy chủ để kiểm tra phiên. Vui lòng kiểm tra mạng và làm mới lại.');
      } else if (error.status === 401 || error.status === 404) {
        // Chỉ xóa phiên khi máy chủ xác nhận token/tài khoản không còn hiệu lực
        logout();
        setLoading(false);
        setSessionError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else {
        setSessionError(error.message);
      }
    } finally {
      if (sessionEpoch.current === currentEpoch) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void restoreSession();

    const expired = () => logout();

    // Đồng bộ đa tab: localStorage thay đổi từ tab khác
    const sync = (event: StorageEvent) => {
      if ((event.key === 'sme_token' && event.newValue === null) || event.key === null) {
        logout();
      } else if (event.key === 'sme_token' && event.newValue !== null) {
        void restoreSession();
      } else if (event.key === 'sme_active_role' && event.newValue !== null) {
        const newRole = event.newValue as RoleCode;
        setUser(currentUser => {
          if (currentUser?.roles.includes(newRole)) {
            sessionEpoch.current++;
            updateRole(newRole);
          }
          return currentUser;
        });
      }
    };

    // D7-02: Phục hồi một lần khi vai trò đang dùng bị tước (ACTIVE_ROLE_INVALID)
    const onRoleInvalidated = async (event: Event) => {
      if (recoveringRef.current) return;
      const token = getAuthToken();
      const currentRole = localStorage.getItem('sme_active_role');
      if (!token) return;

      const customEvent = event as CustomEvent<{ token?: string; requestedRole?: string; availableRoles?: RoleCode[] }>;
      // Nếu sự kiện mang token khác token hiện tại -> bỏ qua phản hồi từ phiên khác
      if (customEvent.detail?.token && customEvent.detail.token !== token) return;

      recoveringRef.current = true;
      const currentEpoch = ++sessionEpoch.current;

      try {
        let profile: User | null = null;
        try {
          profile = await api.get<User>('/auth/me');
        } catch (err) {
          // BẢN SỬA: Nhánh lỗi phục hồi cũ không được logout hoặc thay đổi phiên mới.
          // Bắt buộc kiểm tra epoch và token/role trước MỌI cập nhật trạng thái liên quan trong catch!
          if (sessionEpoch.current !== currentEpoch || getAuthToken() !== token) return;
          if (localStorage.getItem('sme_active_role') !== currentRole) return;

          const error = err as ApiError;
          // Lỗi mạng/timeout/5xx: KHÔNG kết luận tài khoản bị khóa hoặc tự xóa phiên!
          if (error.status === 0 || error.status === 408 || error.status >= 500) {
            setSessionNotice('Không thể kết nối đến máy chủ để cập nhật vai trò mới. Vui lòng kiểm tra mạng.');
            return;
          }
          // Lỗi xác thực thực sự (401/404) -> kết thúc an toàn
          if (error.status === 401 || error.status === 404) {
            logout();
            setSessionError('Tài khoản không tồn tại hoặc đã bị khóa. Phiên làm việc đã kết thúc.');
            return;
          }
          setSessionNotice(error.message);
          return;
        }

        // Bỏ qua nếu trong lúc chờ /auth/me người dùng đã logout, login khác hoặc đổi vai trò
        if (sessionEpoch.current !== currentEpoch || getAuthToken() !== token) return;
        if (localStorage.getItem('sme_active_role') !== currentRole) return;

        // BẢN SỬA: Đồng nhất contract /auth/me: thiếu isActive không đồng nghĩa bị khóa!
        // AuthService.getProfile thật chỉ trả về id, username, fullName, email, phone, branchName, roles (không có isActive).
        // Chỉ khi profile.isActive === false tường minh hoặc không còn roles mới kết thúc phiên.
        if (!profile || profile.isActive === false || !profile.roles?.length) {
          logout();
          setSessionError('Tài khoản đã bị khóa hoặc không còn vai trò hợp lệ. Phiên làm việc đã kết thúc.');
          return;
        }

        // Chọn vai trò còn hiệu lực: ưu tiên vai trò đầu tiên trong danh sách profile mới
        const available = customEvent.detail?.availableRoles?.filter(r => profile.roles.includes(r)) || profile.roles;
        const fallbackRole = available[0] || profile.roles[0];
        setActiveRole(fallbackRole);
        updateRole(fallbackRole);
        setUser(profile);
        setSessionNotice(`Vai trò trước đó không còn hiệu lực. Hệ thống đã tự động chuyển sang vai trò: ${ROLE_NAMES[fallbackRole] || fallbackRole}.`);
        setSessionError('');
      } finally {
        setTimeout(() => {
          recoveringRef.current = false;
        }, 500);
      }
    };

    window.addEventListener('sme-session-expired', expired);
    window.addEventListener('storage', sync);
    window.addEventListener('sme-role-invalidated', onRoleInvalidated);

    return () => {
      window.removeEventListener('sme-session-expired', expired);
      window.removeEventListener('storage', sync);
      window.removeEventListener('sme-role-invalidated', onRoleInvalidated);
    };
  }, []);

  const login = async (username: string, password: string) => {
    sessionEpoch.current++;
    setSessionNotice('');
    setSessionError('');
    const result = await api.post<{ accessToken: string; user: User }>('/auth/login', { username, password });
    acceptUser(result.user);
    setAuthToken(result.accessToken);
  };

  const selectRole = (role: RoleCode) => {
    if (user?.roles.includes(role)) {
      sessionEpoch.current++;
      setActiveRole(role);
      updateRole(role);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionError,
        sessionNotice,
        activeRole,
        login,
        logout,
        selectRole,
        hasRole: role => activeRole === role,
        restoreSession,
        clearSessionNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
