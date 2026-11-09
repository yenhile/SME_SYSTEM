/**
 * Đặc trưng gửi sang ml-service (mô hình v4). Hàm thuần để kiểm thử được; việc đọc dữ liệu nằm ở prediction.service.ts.
 * Đơn vị thời gian: giờ làm việc ngân hàng của công đoạn đang mở (đã trừ thời gian chờ doanh nghiệp, đúng chính sách PA1).
 */
export type PredictionStage = 'TIEP_NHAN' | 'THAM_DINH';

export interface FeatureInput {
  stage: PredictionStage;
  applicationCode: string;
  slaHours: number;
  elapsedHours: number;
  hoursSinceLastEvent: number;
  proposedAmountVnd: number;
  loanTermMonths: number;
  establishedYear: number;
  annualRevenueVnd: number;
  portalData?: { hasExistingDebt?: unknown; businessScope?: unknown; collateral?: { mode?: unknown } } | null;
  supplementCount: number;
  itemsPendingReview: number;
  officerWorkload: number;
  tnBankHours: number;
  appraisalQueueLen: number;
  appraisersActive: number;
  clarifyRoundsSoFar: number;
  clarifyOpen: boolean;
  now?: Date;
}

const SCOPE: Record<string, string> = { MANUFACTURING: 'SAN_XUAT', TRADING: 'THUONG_MAI', SERVICES: 'DICH_VU', OTHER: 'KHAC' };
const COLLATERAL = ['PROPOSED', 'NONE_REQUESTED', 'UNDECIDED'];
const r2 = (n: number) => Math.round(n * 100) / 100;

export function businessScopeOf(value: unknown, industry?: string): string {
  if (typeof value === 'string' && SCOPE[value]) return SCOPE[value];
  const text = (industry ?? '').toLowerCase();   // hồ sơ cũ chưa có businessScope: suy từ ngành của doanh nghiệp
  if (/sản xuất|chế biến|may mặc|xây dựng|cơ khí/.test(text)) return 'SAN_XUAT';
  if (/thương mại|bán|nông nghiệp|thủy sản/.test(text)) return 'THUONG_MAI';
  if (/dịch vụ|vận tải|kho bãi|logistics/.test(text)) return 'DICH_VU';
  return 'THUONG_MAI';
}

export function buildPredictPayload(input: FeatureInput & { industry?: string }) {
  const year = (input.now ?? new Date()).getFullYear();
  const mode = input.portalData?.collateral?.mode;
  return {
    application_id: input.applicationCode,
    stage: input.stage,
    sla_hours: input.slaHours,
    elapsed_hours: r2(Math.max(0, input.elapsedHours)),
    hours_since_last_event: r2(Math.max(0, input.hoursSinceLastEvent)),
    proposed_amount_billion: r2(input.proposedAmountVnd / 1e9),
    loan_term_months: Math.min(120, Math.max(1, input.loanTermMonths)),
    established_years: Math.max(0, year - input.establishedYear),
    annual_revenue_billion: r2(Math.max(0, input.annualRevenueVnd) / 1e9),
    has_existing_debt: input.portalData?.hasExistingDebt === true ? 1 : 0,
    business_scope: businessScopeOf(input.portalData?.businessScope, input.industry),
    collateral_mode: typeof mode === 'string' && COLLATERAL.includes(mode) ? mode : 'UNDECIDED',
    ...(input.stage === 'TIEP_NHAN'
      ? { supplement_rounds_so_far: input.supplementCount, items_pending_review: input.itemsPendingReview, officer_workload: Math.max(1, input.officerWorkload) }
      : {
          supplement_rounds_total: input.supplementCount, tn_bank_hours: r2(Math.max(0, input.tnBankHours)),
          appraisal_queue_len: input.appraisalQueueLen, appraisers_active: Math.max(1, input.appraisersActive),
          clarify_rounds_so_far: input.clarifyRoundsSoFar, clarify_open: input.clarifyOpen ? 1 : 0,
        }),
  };
}

/** Mức cảnh báo từ ml-service → RiskLevel đang lưu trong DB (không đổi lược đồ). */
export function riskLevelOf(alertLevel: string): 'THAP' | 'TRUNG_BINH' | 'CAO' {
  if (alertLevel === 'KHAN' || alertLevel === 'QUA_HAN') return 'CAO';
  if (alertLevel === 'CHU_Y') return 'TRUNG_BINH';
  return 'THAP';
}
