import type { RoleCode } from './types';

export type Tab = 'dashboard' | 'users' | 'companies' | 'loans' | 'appraisal' | 'assignments' | 'activity' | 'settings' | 'rates';
type GroupId = 'overview' | 'operations' | 'loans' | 'system';
interface NavItem {
  tab: Tab;
  group: GroupId;
  label: string;
  /** Vai trò được vào mục này; vai trò khác thấy mục ở dạng khóa và không mở được trang dù biết đường dẫn. Khớp quyền backend. */
  roles: readonly RoleCode[];
  unavailable?: boolean;
}

export const NAV_GROUPS: { id: GroupId; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'operations', label: 'Cài đặt vận hành' },
  { id: 'loans', label: 'Quản lý hồ sơ' },
  { id: 'system', label: 'Hệ thống' },
];

/** Admin mở được mọi trang nghiệp vụ ở chế độ chỉ xem; backend chặn mọi thao tác ghi của Admin. */
const LOAN_ROLES: readonly RoleCode[] = ['CBTD', 'QUAN_LY', 'THAM_QUYEN', 'ADMIN'];

export const NAV_ITEMS: NavItem[] = [
  { tab: 'dashboard', group: 'overview', label: 'Dashboard tổng quan', roles: ['CBTD', 'QUAN_LY', 'THAM_QUYEN', 'ADMIN'] },
  { tab: 'users', group: 'operations', label: 'Liên hệ cá nhân', roles: ['ADMIN'] },
  { tab: 'companies', group: 'operations', label: 'Liên hệ doanh nghiệp', roles: LOAN_ROLES },
  { tab: 'settings', group: 'operations', label: 'Cấu hình SLA', roles: ['ADMIN'] },
  { tab: 'rates', group: 'operations', label: 'Khung lãi suất', roles: ['ADMIN'] },
  { tab: 'loans', group: 'loans', label: 'Danh sách hồ sơ', roles: LOAN_ROLES },
  // Khu làm việc của Thẩm quyền: CBTD không vào; Quản lý vào để theo dõi, không thao tác.
  { tab: 'appraisal', group: 'loans', label: 'Thẩm định & phê duyệt', roles: ['QUAN_LY', 'THAM_QUYEN', 'ADMIN'] },
  { tab: 'assignments', group: 'loans', label: 'Điều chuyển & phân công', roles: ['QUAN_LY', 'ADMIN'] },
  { tab: 'activity', group: 'system', label: 'Lịch sử hoạt động', roles: ['ADMIN'] },
];

type RoleInput = RoleCode | null | undefined;

/** Các mục menu mà vai trò đang dùng có quyền. Chưa có vai trò thì không có mục nào. */
export function allowedNavItems(role: RoleInput): NavItem[] {
  return role ? NAV_ITEMS.filter(item => item.roles.includes(role)) : [];
}

export type MenuAccess = 'open' | 'locked' | 'unavailable';

/** Toàn bộ menu kèm tình trạng với vai trò đang dùng: mục ngoài quyền vẫn hiện nhưng bị khóa. */
export function menuItems(role: RoleInput): (NavItem & { access: MenuAccess })[] {
  const allowed = new Set(allowedNavItems(role).map(item => item.tab));
  return NAV_ITEMS.map(item => ({ ...item, access: item.unavailable ? 'unavailable' : allowed.has(item.tab) ? 'open' : 'locked' }));
}

export function canOpenTab(tab: Tab, role: RoleInput): boolean {
  return allowedNavItems(role).some(item => item.tab === tab && !item.unavailable);
}

/** Trang đầu theo vai trò: luôn là trang vai trò đó được phép (không đưa CBTD hay Admin vào trang bị từ chối). */
export function getDefaultTab(role: RoleInput): Tab {
  if (role === 'CBTD') return 'dashboard';
  if (role === 'THAM_QUYEN') return 'appraisal';
  return 'dashboard';
}

/** Trang không được phép (gõ đường dẫn, đổi vai trò) quay về trang đầu của vai trò hiện tại. */
export function resolveTab(tab: Tab, role: RoleInput): Tab {
  return canOpenTab(tab, role) ? tab : getDefaultTab(role);
}
