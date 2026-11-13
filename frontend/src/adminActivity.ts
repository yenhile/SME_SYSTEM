export const ACTION_LABELS = {
  USER_CREATED: 'Tạo tài khoản',
  USER_PROFILE_UPDATED: 'Sửa thông tin tài khoản',
  USER_LOCKED: 'Khóa tài khoản',
  USER_UNLOCKED: 'Mở khóa tài khoản',
  USER_ROLES_CHANGED: 'Đổi vai trò',
  STAGE_SLA_UPDATED: 'Sửa định mức SLA',
  INTEREST_RATE_BAND_CREATED: 'Thêm khung lãi suất',
} as const;
export type AuditAction = keyof typeof ACTION_LABELS;

export interface AuditEntry {
  id: string;
  actorId: string;
  actorUsername: string;
  actorName: string;
  action: AuditAction;
  targetType: 'USER' | 'WORKFLOW_STAGE' | 'INTEREST_RATE_BAND';
  targetId: string;
  targetLabel: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}
export interface AuditPage { items: AuditEntry[]; total: number; page: number; pageSize: number }
export interface AuditFilters { actorId: string; action: string; from: string; to: string }
export const EMPTY_AUDIT_FILTERS: AuditFilters = { actorId: '', action: '', from: '', to: '' };
export const AUDIT_PAGE_SIZE = 20;

export interface ValueFormat { roleName: (code: string) => string; slaText: (hours: number) => string }

const FIELD_LABELS: Record<string, string> = {
  username: 'Tên đăng nhập',
  fullName: 'Họ tên',
  email: 'Email',
  phone: 'Số điện thoại',
  branchName: 'Chi nhánh',
  isActive: 'Trạng thái',
  roles: 'Vai trò',
  standardSlaHours: 'Định mức SLA',
  minRate: 'Sàn',
  maxRate: 'Trần',
  effectiveFrom: 'Hiệu lực từ',
  basis: 'Căn cứ ban hành',
};

export function auditLogPath(filters: AuditFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  for (const key of ['actorId', 'action', 'from', 'to'] as const) if (filters[key]) params.set(key, filters[key]);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return `/admin/audit-logs?${params.toString()}`;
}

export function filterError(filters: AuditFilters): string | null {
  return filters.from && filters.to && filters.from > filters.to ? 'Từ ngày phải trước hoặc bằng Đến ngày.' : null;
}

function valueText(field: string, value: unknown, fmt: ValueFormat): string {
  if (value === null || value === undefined || value === '') return '(trống)';
  if (field === 'isActive') return value ? 'Hoạt động' : 'Đã khóa';
  if (field === 'roles' && Array.isArray(value)) return value.map(code => fmt.roleName(String(code))).join(', ');
  if (field === 'standardSlaHours' && typeof value === 'number') return fmt.slaText(value);
  if ((field === 'minRate' || field === 'maxRate') && typeof value === 'number') return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%/năm`;
  if (field === 'effectiveFrom' && typeof value === 'string') return new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
  return String(value);
}

/** Tạo tài khoản chỉ có giá trị sau; các thao tác khác hiện "trước → sau" cho từng trường đã đổi. */
export function changeLines(entry: Pick<AuditEntry, 'action' | 'before' | 'after'>, fmt: ValueFormat): string[] {
  const after = entry.after ?? {};
  const fields = Object.keys(after).filter(field => FIELD_LABELS[field]);
  if (!entry.before) return fields.map(field => `${FIELD_LABELS[field]}: ${valueText(field, after[field], fmt)}`);
  const before = entry.before;
  return fields.map(field => `${FIELD_LABELS[field]}: ${valueText(field, before[field], fmt)} → ${valueText(field, after[field], fmt)}`);
}
