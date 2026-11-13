import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';

export const QUEUE_GROUPS = ['DECIDE', 'CBTD', 'ENTERPRISE', 'OTHER_REVIEWER'] as const;
export type QueueGroup = (typeof QUEUE_GROUPS)[number];
export type QueueReason = 'SUBMITTED' | 'LEGACY' | 'CLARIFICATION' | 'EVIDENCE_CHANGED' | 'NO_REPORT' | 'CONFLICT' | 'SUPPLEMENT' | 'NOT_INDEPENDENT';

export interface QueueActor { id: string; activeRole?: string }

export interface QueueFacts {
  currentStatus: string;
  businessPolicyVersion: string | null;
  assignedTo: string | null;
  intakeOfficerId: string | null;
  supplementRequests: unknown[];
  coordinationRequests: unknown[];
  appraisalReport: { status: string; versions: { evidenceHash: string }[]; events: unknown[] } | null;
}

export function assertQueueRequest(queue: string, actor: QueueActor): QueueGroup {
  if (!QUEUE_GROUPS.includes(queue as QueueGroup)) throw new BadRequestException('Nhóm hồ sơ không hợp lệ.');
  if (actor.activeRole !== RoleCode.THAM_QUYEN && actor.activeRole !== RoleCode.QUAN_LY && actor.activeRole !== RoleCode.ADMIN) throw new ForbiddenException('Vai trò của bạn không xem được hàng việc thẩm định.');
  return queue as QueueGroup;
}

/** Hồ sơ người quyết định không độc lập phải do Thẩm quyền khác xử lý; Quản lý chỉ theo dõi nên không xét điều kiện này. */
function isIndependent(row: QueueFacts, actor: QueueActor): boolean {
  if (actor.activeRole !== RoleCode.THAM_QUYEN) return true;
  return row.assignedTo !== actor.id && row.intakeOfficerId !== actor.id && !row.appraisalReport?.events.length;
}

/** Hồ sơ quy trình cũ không có tờ trình và CBTD không lập được, nên chỉ còn chờ Thẩm quyền quyết định. */
export function classifyQueueRow(row: QueueFacts, evidenceChanged: boolean, actor: QueueActor): { group: QueueGroup; reason: QueueReason } {
  if (row.currentStatus === 'SUPPLEMENT_REQUIRED' || row.supplementRequests.length) return { group: 'ENTERPRISE', reason: 'SUPPLEMENT' };
  if (row.coordinationRequests.length) return { group: 'CBTD', reason: 'CONFLICT' };
  if (!isIndependent(row, actor)) return { group: 'OTHER_REVIEWER', reason: 'NOT_INDEPENDENT' };
  if (!row.businessPolicyVersion) return { group: 'DECIDE', reason: 'LEGACY' };
  const report = row.appraisalReport;
  if (report?.status === 'CLARIFICATION_REQUIRED') return { group: 'CBTD', reason: 'CLARIFICATION' };
  if (report?.status !== 'SUBMITTED' || !report.versions.length) return { group: 'CBTD', reason: 'NO_REPORT' };
  return evidenceChanged ? { group: 'CBTD', reason: 'EVIDENCE_CHANGED' } : { group: 'DECIDE', reason: 'SUBMITTED' };
}
