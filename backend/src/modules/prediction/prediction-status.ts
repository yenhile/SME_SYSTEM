/**
 * Tình trạng dự báo trễ SLA của hồ sơ để giao diện nói đúng thay vì bịa xác suất.
 * - AVAILABLE: có dự báo đã lưu.
 * - NONE: chưa có dự báo (chưa có sự kiện kích hoạt, hoặc công đoạn chưa tính SLA theo giờ làm việc PA1).
 * - INCOMPATIBLE_PA1: giữ lại cho tương thích kiểu dữ liệu cũ; mô hình v4 hỗ trợ PA1 nên backend không còn trả giá trị này.
 */
export type PredictionStatus = 'AVAILABLE' | 'INCOMPATIBLE_PA1' | 'NONE';

export type PredictionUnavailableReason = 'NO_ACTIVE_STAGE' | 'STAGE_NOT_SUPPORTED' | 'LEGACY_SLA' | 'CALENDAR_OUT_OF_RANGE' | 'SLA_OUT_OF_RANGE';

export const PREDICTION_UNAVAILABLE_MESSAGES: Record<PredictionUnavailableReason, string> = {
  NO_ACTIVE_STAGE: 'Hồ sơ đã hoàn tất, không còn công đoạn để dự báo.',
  STAGE_NOT_SUPPORTED: 'Chỉ dự báo ở công đoạn Tiếp nhận và Thẩm định.',
  LEGACY_SLA: 'Công đoạn này chưa tính SLA theo giờ làm việc (PA1) nên chưa có dự báo.',
  CALENDAR_OUT_OF_RANGE: 'Thời điểm hiện tại nằm ngoài lịch làm việc đã nạp nên chưa dự báo được.',
  SLA_OUT_OF_RANGE: 'SLA của công đoạn nằm ngoài dải mô hình đã học nên chưa dự báo.',
};

export function predictionStatusOf(hasPrediction: boolean): PredictionStatus {
  return hasPrediction ? 'AVAILABLE' : 'NONE';
}
