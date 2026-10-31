// Cách hiển thị SLA và dự báo cho người dùng (C.9.2, mốc 3). Hàm thuần, không phụ thuộc React.

export type PredictionStatus = 'AVAILABLE' | 'INCOMPATIBLE_PA1' | 'NONE';
export interface SlaStateView { policy?: string | null; waiting?: 'ENTERPRISE' | 'BANK' | null; slaRunning?: boolean }

/** Tên cách tính của một công đoạn: null là cách cũ (giờ thực 24/7), 'PA1' là giờ làm việc. */
export function slaPolicyLabel(policy?: string | null): string {
  return policy === 'PA1' ? 'Giờ làm việc (PA1)' : 'Giờ thực (cách cũ)';
}

/** Hồ sơ đang chờ bên nào và đồng hồ SLA chạy hay dừng; null khi hồ sơ không ở trạng thái chờ bổ sung. */
export function slaStateLabel(state?: SlaStateView | null): string | null {
  if (!state?.waiting) return null;
  if (state.waiting === 'BANK') return 'Ngân hàng đang kiểm tra phản hồi · SLA đang chạy';
  return state.policy === 'PA1' ? 'Đang chờ doanh nghiệp bổ sung · SLA tạm dừng' : 'Chờ bổ sung · SLA tạm dừng (cách tính cũ)';
}

/** Nhãn khi không có dự báo: nói rõ lý do thay vì hiển thị mức hay xác suất không có thật. */
export function predictionLabel(status?: PredictionStatus | null): string {
  return status === 'INCOMPATIBLE_PA1' ? 'Chưa có dự báo tương thích PA1' : 'Chưa dự báo';
}

/** Số giờ làm tròn tới 2 chữ số thập phân; thiếu giá trị thì hiển thị gạch ngang. */
export function hoursText(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100) / 100}h`;
}

/** Bên đang chờ trên danh sách quá hạn của Quản lý. */
export function waitingOnLabel(waitingOn?: 'ENTERPRISE' | 'BANK' | null): string {
  if (waitingOn === 'BANK') return 'Chờ ngân hàng kiểm tra';
  return 'Chờ doanh nghiệp';
}
