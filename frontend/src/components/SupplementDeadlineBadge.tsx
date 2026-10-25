interface DeadlineRequest { status: string; reminderSentAt?: string | null; overdueAt?: string | null }

/** Cờ hạn bổ sung chứng từ: vàng khi đã qua mốc nhắc ngày 5, đỏ khi quá hạn. Mốc do backend đánh dấu. */
export function SupplementDeadlineBadge({ requests }: { requests?: DeadlineRequest[] }) {
  const pending = (requests ?? []).filter(request => request.status === 'PENDING');
  if (pending.some(request => request.overdueAt)) return <span className="badge badge-soft-red">🔴 Quá hạn bổ sung</span>;
  if (pending.some(request => request.reminderSentAt)) return <span className="badge badge-soft-amber">🟡 Sắp quá hạn bổ sung</span>;
  return null;
}
