import { SLA_POLICY_PA1 } from '../workflow/sla/sla-policy';

/**
 * Tình trạng dự báo trễ SLA của hồ sơ, để giao diện nói đúng thay vì bịa xác suất (C.9.2).
 * - AVAILABLE: có dự báo đã lưu.
 * - INCOMPATIBLE_PA1: đặc trưng thời gian tiếp nhận của mô hình lấy từ công đoạn tính theo giờ làm việc (PA1),
 *   khác nghĩa với dữ liệu huấn luyện, nên chưa có dự báo tương thích.
 * - NONE: chưa có dự báo (ví dụ hồ sơ chưa qua bước nào kích hoạt dự báo).
 */
export type PredictionStatus = 'AVAILABLE' | 'INCOMPATIBLE_PA1' | 'NONE';

export const PREDICTION_PA1_MESSAGE = 'Chưa có dự báo tương thích PA1.';

export function predictionStatusOf(hasPrediction: boolean, firstStagePolicy: string | null | undefined): PredictionStatus {
  if (firstStagePolicy === SLA_POLICY_PA1) return 'INCOMPATIBLE_PA1';
  return hasPrediction ? 'AVAILABLE' : 'NONE';
}

interface FirstStageReader {
  applicationStageHistory: { findMany(args: any): Promise<Array<{ applicationId: string; slaPolicy: string | null }>> };
}

/** Cách tính SLA của công đoạn Tiếp nhận (công đoạn đầu) của từng hồ sơ; hồ sơ không có dòng thì không có khóa. */
export async function firstStagePolicies(db: FirstStageReader, applicationIds: string[]): Promise<Map<string, string | null>> {
  if (!applicationIds.length) return new Map();
  const rows = await db.applicationStageHistory.findMany({
    where: { applicationId: { in: applicationIds }, stage: { stageCode: 'TIEP_NHAN' } },
    select: { applicationId: true, slaPolicy: true },
    orderBy: { enteredAt: 'asc' },
  });
  const policies = new Map<string, string | null>();
  for (const row of rows) if (!policies.has(row.applicationId)) policies.set(row.applicationId, row.slaPolicy);
  return policies;
}
