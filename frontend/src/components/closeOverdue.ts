interface CloseableLoan {
  currentStatus: string;
  completedAt?: string | null;
  supplementRequests?: { status: string; overdueAt?: string | null }[];
}

/** DEC-02: chỉ Quản lý đóng thủ công, và chỉ khi hồ sơ đang chờ bổ sung đã bị đánh dấu quá hạn. Backend kiểm tra lại. */
export function canCloseOverdue(loan: CloseableLoan, role?: string | null): boolean {
  if (role !== 'QUAN_LY' || loan.currentStatus !== 'SUPPLEMENT_REQUIRED' || loan.completedAt) return false;
  return (loan.supplementRequests ?? []).some(request => request.status === 'PENDING' && Boolean(request.overdueAt));
}
