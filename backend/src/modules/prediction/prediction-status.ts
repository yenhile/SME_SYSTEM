/**
 * Tình trạng dự báo trễ SLA của hồ sơ để giao diện nói đúng thay vì bịa xác suất.
 * - AVAILABLE: có dự báo đã lưu.
 * - NONE: chưa có dự báo (chưa có sự kiện kích hoạt, hoặc công đoạn chưa tính SLA theo giờ làm việc PA1).
 * - INCOMPATIBLE_PA1: giữ lại cho tương thích kiểu dữ liệu cũ; mô hình v4 hỗ trợ PA1 nên backend không còn trả giá trị này.
 */
export type PredictionStatus = 'AVAILABLE' | 'INCOMPATIBLE_PA1' | 'NONE';

export type PredictionUnavailableReason = 'NO_ACTIVE_STAGE' | 'NO_STAGE_HISTORY' | 'STAGE_NOT_SUPPORTED' | 'LEGACY_SLA' | 'CALENDAR_OUT_OF_RANGE' | 'SLA_OUT_OF_RANGE';

export const PREDICTION_UNAVAILABLE_MESSAGES: Record<PredictionUnavailableReason, string> = {
  NO_ACTIVE_STAGE: 'Hồ sơ đã hoàn tất, không còn công đoạn để dự báo.',
  NO_STAGE_HISTORY: 'Hồ sơ đang xử lý nhưng chưa có lịch sử công đoạn theo giờ làm việc nên chưa dự báo được.',
  STAGE_NOT_SUPPORTED: 'Chỉ dự báo ở công đoạn Tiếp nhận và Thẩm định.',
  LEGACY_SLA: 'Công đoạn này chưa tính SLA theo giờ làm việc (PA1) nên chưa có dự báo.',
  CALENDAR_OUT_OF_RANGE: 'Thời điểm hiện tại nằm ngoài lịch làm việc đã nạp nên chưa dự báo được.',
  SLA_OUT_OF_RANGE: 'SLA của công đoạn nằm ngoài dải mô hình đã học nên chưa dự báo.',
};

/** Phiên bản mô hình đang dùng; dự báo của mô hình cũ không còn được hiển thị. */
export const CURRENT_MODEL_PREFIX = 'v4';

/**
 * Dự báo MỚI NHẤT chỉ được dùng khi nói về hồ sơ hiện tại nếu: do mô hình v4 tạo, đúng công đoạn đang mở (modelVersion kết thúc bằng -<công đoạn>),
 * và được tạo sau lúc hồ sơ vào công đoạn đó. Ngược lại trả null để giao diện ghi "Chưa có dự báo" thay vì hiện cảnh báo cũ.
 */
export function currentStagePrediction<T extends { modelVersion: string; predictionTimestamp: Date; riskLevel?: string }>(
  predictions: T[] | null | undefined,
  currentStage: string,
  open: { enteredAt: Date } | null | undefined,
): T | null {
  const latest = predictions?.[0];
  if (!latest || !open || typeof latest.modelVersion !== 'string') return null;
  if (!latest.modelVersion.startsWith(CURRENT_MODEL_PREFIX) || !latest.modelVersion.endsWith(`-${currentStage}`)) return null;
  if (latest.predictionTimestamp.getTime() < open.enteredAt.getTime()) return null;
  // Dòng dự báo Thẩm định lưu trước khi bỏ mức Chú ý (L9) vẫn được hiển thị đúng quy tắc mới mà không cần chấm lại.
  if (currentStage === 'THAM_DINH' && latest.riskLevel === 'TRUNG_BINH') return { ...latest, riskLevel: 'THAP' };
  return latest;
}

export function predictionStatusOf(hasPrediction: boolean): PredictionStatus {
  return hasPrediction ? 'AVAILABLE' : 'NONE';
}
