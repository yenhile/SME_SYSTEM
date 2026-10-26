export type NotificationTarget = { kind: 'intake' | 'loan'; id: string };

/** Thông báo Portal mở đề nghị tiếp nhận; thông báo gắn hồ sơ (nhắc/quá hạn bổ sung) mở thẳng hồ sơ vay. */
export function notificationTarget(item: { requestId?: string | null; applicationId?: string | null }): NotificationTarget | null {
  if (item.requestId) return { kind: 'intake', id: item.requestId };
  if (item.applicationId) return { kind: 'loan', id: item.applicationId };
  return null;
}
