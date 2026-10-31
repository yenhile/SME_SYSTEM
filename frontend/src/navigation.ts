import type { RoleCode } from './types';

export type Tab = 'dashboard' | 'users' | 'companies' | 'loans' | 'appraisal' | 'issues' | 'assignments' | 'activity' | 'settings';
type GroupId = 'overview' | 'operations' | 'loans' | 'system';
interface NavItem {
  tab: Tab;
  group: GroupId;
  label: string;
  /** Vai trò được vào mục này; vai trò khác không thấy menu và không mở được trang dù biết đường dẫn. Khớp quyền backend. */
  roles: readonly RoleCode[];
  unavailable?: boolean;
}

export const NAV_GROUPS: { id: GroupId; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'operations', label: 'Cài đặt vận hành' },
  { id: 'loans', label: 'Quản lý hồ sơ' },
  { id: 'system', label: 'Hệ thống' },
];

const LOAN_ROLES: readonly RoleCode[] = ['CBTD', 'QUAN_LY', 'THAM_QUYEN'];

export const NAV_ITEMS: NavItem[] = [
  { tab: 'dashboard', group: 'overview', label: 'Dashboard tổng quan', roles: ['QUAN_LY', 'THAM_QUYEN'] },
  { tab: 'users', group: 'operations', label: 'Liên hệ cá nhân', roles: ['ADMIN'] },
  { tab: 'companies', group: 'operations', label: 'Liên hệ doanh nghiệp', roles: LOAN_ROLES },
  { tab: 'settings', group: 'operations', label: 'Cấu hình SLA', roles: ['ADMIN'] },
  { tab: 'loans', group: 'loans', label: 'Danh sách hồ sơ', roles: LOAN_ROLES },
  // Khu làm việc của Thẩm quyền: CBTD không vào; Quản lý vào để theo dõi, không thao tác.
  { tab: 'appraisal', group: 'loans', label: 'Thẩm định & phê duyệt', roles: ['QUAN_LY', 'THAM_QUYEN'] },
  { tab: 'issues', group: 'loans', label: 'Quản lý vấn đề hồ sơ', roles: LOAN_ROLES, unavailable: true },
  { tab: 'assignments', group: 'loans', label: 'Điều chuyển & phân công', roles: ['QUAN_LY'] },
  { tab: 'activity', group: 'system', label: 'Lịch sử hoạt động', roles: ['ADMIN', 'QUAN_LY'], unavailable: true },
];

type RoleInput = RoleCode | null | undefined;

/** Các mục menu mà vai trò đang dùng được thấy. Chưa có vai trò thì không thấy mục nào. */
export function visibleNavItems(role: RoleInput): NavItem[] {
  return role ? NAV_ITEMS.filter(item => item.roles.includes(role)) : [];
}

export function canOpenTab(tab: Tab, role: RoleInput): boolean {
  return visibleNavItems(role).some(item => item.tab === tab && !item.unavailable);
}

/** Trang đầu theo vai trò: luôn là trang vai trò đó được phép (không đưa CBTD hay Admin vào trang bị từ chối). */
export function getDefaultTab(role: RoleInput): Tab {
  if (role === 'ADMIN') return 'users';
  if (role === 'CBTD') return 'loans';
  return 'dashboard';
}

/** Trang không được phép (gõ đường dẫn, đổi vai trò) quay về trang đầu của vai trò hiện tại. */
export function resolveTab(tab: Tab, role: RoleInput): Tab {
  return canOpenTab(tab, role) ? tab : getDefaultTab(role);
}

export function filterLoansForView<T extends { currentStage: string }>(loans: T[], scope: 'all' | 'appraisal'): T[] {
  return scope === 'appraisal' ? loans.filter(loan => ['THAM_DINH', 'CAP_TREN'].includes(loan.currentStage)) : loans;
}
