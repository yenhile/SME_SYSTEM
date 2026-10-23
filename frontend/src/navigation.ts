export type Tab = 'dashboard' | 'users' | 'companies' | 'loans' | 'appraisal' | 'issues' | 'assignments' | 'activity';
type GroupId = 'overview' | 'operations' | 'loans' | 'system';
interface NavItem {
  tab: Tab;
  group: GroupId;
  label: string;
  unavailable?: boolean;
}

export const NAV_GROUPS: { id: GroupId; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'operations', label: 'Cài đặt vận hành' },
  { id: 'loans', label: 'Quản lý hồ sơ' },
  { id: 'system', label: 'Hệ thống' },
];

export const NAV_ITEMS: NavItem[] = [
  { tab: 'dashboard', group: 'overview', label: 'Dashboard tổng quan' },
  { tab: 'users', group: 'operations', label: 'Liên hệ cá nhân' },
  { tab: 'companies', group: 'operations', label: 'Liên hệ doanh nghiệp' },
  { tab: 'loans', group: 'loans', label: 'Danh sách hồ sơ' },
  { tab: 'appraisal', group: 'loans', label: 'Thẩm định & phê duyệt' },
  { tab: 'issues', group: 'loans', label: 'Quản lý vấn đề hồ sơ', unavailable: true },
  { tab: 'assignments', group: 'loans', label: 'Điều chuyển & phân công' },
  { tab: 'activity', group: 'system', label: 'Lịch sử hoạt động', unavailable: true },
];

export function canOpenTab(tab: Tab): boolean {
  return NAV_ITEMS.some(item => item.tab === tab && !item.unavailable);
}

export function getDefaultTab(): Tab {
  return 'dashboard';
}

export function resolveTab(tab: Tab): Tab {
  return canOpenTab(tab) ? tab : getDefaultTab();
}

export function filterLoansForView<T extends { currentStage: string }>(loans: T[], scope: 'all' | 'appraisal'): T[] {
  return scope === 'appraisal' ? loans.filter(loan => ['THAM_DINH', 'CAP_TREN'].includes(loan.currentStage)) : loans;
}
