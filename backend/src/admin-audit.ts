import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const ADMIN_AUDIT_ACTIONS = [
  'USER_CREATED',
  'USER_PROFILE_UPDATED',
  'USER_LOCKED',
  'USER_UNLOCKED',
  'USER_ROLES_CHANGED',
  'STAGE_SLA_UPDATED',
  'INTEREST_RATE_BAND_CREATED',
] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

type AuditValues = Record<string, unknown> | null;
export interface AdminAuditEntry {
  action: AdminAuditAction;
  targetType: 'USER' | 'WORKFLOW_STAGE' | 'INTEREST_RATE_BAND';
  targetId: string;
  targetLabel: string;
  before: AuditValues;
  after: AuditValues;
}

const PROFILE_FIELDS = ['fullName', 'phone', 'branchName'] as const;
export interface AccountState {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  branchName: string | null;
  isActive: boolean;
  roles: string[];
}
export interface AccountChange {
  fullName?: string;
  phone?: string;
  branchName?: string;
  isActive?: boolean;
  roles?: string[];
}

const sortedRoles = (roles: string[]) => [...roles].sort();

/** Mỗi loại thay đổi trong một lần lưu là một dòng; trường gửi lên nhưng giữ nguyên giá trị không được ghi. */
export function accountChangeEntries(current: AccountState, change: AccountChange): AdminAuditEntry[] {
  const target = { targetType: 'USER' as const, targetId: current.id, targetLabel: current.username };
  const entries: AdminAuditEntry[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) {
    if (change[field] !== undefined && change[field] !== current[field]) {
      before[field] = current[field];
      after[field] = change[field];
    }
  }
  if (Object.keys(after).length) entries.push({ action: 'USER_PROFILE_UPDATED', ...target, before, after });
  if (change.isActive !== undefined && change.isActive !== current.isActive) {
    entries.push({ action: change.isActive ? 'USER_UNLOCKED' : 'USER_LOCKED', ...target, before: { isActive: current.isActive }, after: { isActive: change.isActive } });
  }
  if (change.roles) {
    const was = sortedRoles(current.roles);
    const now = sortedRoles(change.roles);
    if (was.join() !== now.join()) entries.push({ action: 'USER_ROLES_CHANGED', ...target, before: { roles: was }, after: { roles: now } });
  }
  return entries;
}

/** Ghi trong transaction của chính thao tác: thao tác bị hủy thì nhật ký cũng không còn. */
export async function recordAdminActions(tx: Prisma.TransactionClient, actorId: string, entries: AdminAuditEntry[]) {
  if (!entries.length) return;
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { username: true, fullName: true } });
  if (!actor) throw new NotFoundException('Không xác định được người thực hiện thao tác quản trị.');
  await tx.adminAuditLog.createMany({
    data: entries.map(({ before, after, ...entry }) => ({
      actorId,
      actorUsername: actor.username,
      actorName: actor.fullName,
      ...entry,
      ...(before ? { before: before as Prisma.InputJsonObject } : {}),
      ...(after ? { after: after as Prisma.InputJsonObject } : {}),
    })),
  });
}

export const AUDIT_DEFAULT_PAGE_SIZE = 20;
export const AUDIT_MAX_PAGE_SIZE = 100;
export interface AuditLogQuery {
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
function vnDayStart(value: string, label: string): Date {
  const [y, m, d] = DAY.test(value) ? value.split('-').map(Number) : [NaN, NaN, NaN];
  const day = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(day.getTime()) || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) {
    throw new BadRequestException(`${label} phải là ngày hợp lệ dạng YYYY-MM-DD.`);
  }
  return new Date(day.getTime() - 7 * 3600 * 1000);
}
function positive(value: string, label: string, max?: number): number {
  const n = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n < 1 || (max !== undefined && n > max)) throw new BadRequestException(`${label} phải là số nguyên từ 1${max ? ` đến ${max}` : ''}.`);
  return n;
}

/** Ngày lọc tính theo giờ Việt Nam; ngày kết thúc lấy trọn ngày. */
export function auditLogFilter(query: AuditLogQuery) {
  const where: Prisma.AdminAuditLogWhereInput = {};
  if (query.actorId !== undefined) {
    if (!query.actorId.trim()) throw new BadRequestException('Người thực hiện không hợp lệ.');
    where.actorId = query.actorId;
  }
  if (query.action !== undefined) {
    if (!ADMIN_AUDIT_ACTIONS.includes(query.action as AdminAuditAction)) throw new BadRequestException('Loại thao tác không hợp lệ.');
    where.action = query.action;
  }
  const from = query.from === undefined ? undefined : vnDayStart(query.from, 'Từ ngày');
  const to = query.to === undefined ? undefined : new Date(vnDayStart(query.to, 'Đến ngày').getTime() + 24 * 3600 * 1000);
  if (from && to && from >= to) throw new BadRequestException('Từ ngày phải trước hoặc bằng Đến ngày.');
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
  const page = query.page === undefined ? 1 : positive(query.page, 'Trang');
  const pageSize = query.pageSize === undefined ? AUDIT_DEFAULT_PAGE_SIZE : positive(query.pageSize, 'Số dòng mỗi trang', AUDIT_MAX_PAGE_SIZE);
  return { where, page, pageSize };
}
