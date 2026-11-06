import { StageCode } from '@prisma/client';

export interface QueueRow {
  currentStage: StageCode | string;
  completedAt: Date | null;
  createdAt: Date;
  sla: { isOverdue: boolean; dueAt: Date | null; waitingEnterprise: boolean } | null;
}

function queueRank(row: QueueRow): number {
  if (row.completedAt || row.currentStage === StageCode.HOAN_TAT) return 4;
  if (!row.sla) return 3;
  if (row.sla.isOverdue) return 0;
  return row.sla.dueAt && !row.sla.waitingEnterprise ? 1 : 2;
}

/** Quá hạn trước, rồi hạn gần nhất, đang tạm dừng, chưa có dữ liệu SLA; hồ sơ đã kết thúc xếp cuối, mới kết thúc trước. */
export function compareLoanQueue(a: QueueRow, b: QueueRow): number {
  const rank = queueRank(a) - queueRank(b);
  if (rank) return rank;
  const due = (a.sla?.dueAt?.getTime() ?? 0) - (b.sla?.dueAt?.getTime() ?? 0);
  if (due) return due;
  const closed = (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0);
  return closed || b.createdAt.getTime() - a.createdAt.getTime();
}
