// Theo dõi tiến độ hồ sơ cho doanh nghiệp (TK-06). Chỉ dựng từ các trường công khai được liệt kê rõ;
// không đọc ghi chú nội bộ, cán bộ phụ trách, điểm/dự báo ML hay số tiền duyệt.

/** Danh mục lý do từ chối chung (TC01–TC05) được phép hiển thị cho doanh nghiệp. */
export const PUBLIC_REJECTION_REASONS: Record<string, string> = {
  TC01: 'Hồ sơ pháp lý không hợp lệ',
  TC02: 'Năng lực tài chính không đảm bảo',
  TC03: 'Phương án kinh doanh không khả thi',
  TC04: 'Tài sản bảo đảm không đủ điều kiện',
  TC05: 'Quá hạn thời gian bổ sung chứng từ',
};
const GENERIC_REJECTION = 'Hồ sơ không được chấp thuận';

const STEP_LABELS = ['Tiếp nhận', 'Thẩm định', 'Phê duyệt', 'Hoàn tất'] as const;
const STEP_CODES = ['RECEIVE', 'APPRAISAL', 'APPROVAL', 'DONE'] as const;
const STAGE_ORDER = ['TIEP_NHAN', 'THAM_DINH', 'CAP_TREN'];

export type StepState = 'done' | 'current' | 'pending' | 'stopped';

export interface TrackingLoan {
  currentStage: string;
  currentStatus: string;
  completedAt?: Date | null;
  rejectionReasonCode?: string | null;
  stageHistories?: { stage: { stageCode: string } }[];
}
export interface TrackingRequest {
  id: string;
  reference: string;
  status: string;
  submittedAt?: Date | null;
  acceptedAt?: Date | null;
}

const PRE_ACCEPTANCE: Record<string, { label: string; message: string }> = {
  DRAFT: { label: 'Bản nháp', message: 'Đề nghị chưa được gửi. Hoàn tất thông tin và tài liệu rồi gửi cho ngân hàng.' },
  SUBMITTED: { label: 'Đã gửi, chờ phân công', message: 'Ngân hàng đã nhận đề nghị và đang phân công cán bộ xử lý.' },
  ASSIGNED: { label: 'Chờ ngân hàng tiếp nhận', message: 'Đề nghị đã được phân công và đang chờ ngân hàng tiếp nhận chính thức.' },
  RETURNED: {label:'Cần chỉnh sửa đề nghị',message:'Ngân hàng đã gửi danh sách yêu cầu chỉnh sửa. Mở đề nghị để sửa và gửi lại trên cùng mã.'},
};

const LOAN_STATUS: Record<string, { code: string; label: string; message: string }> = {
  RECEIVED: { code: 'RECEIVED', label: 'Đang kiểm tra hồ sơ', message: 'Ngân hàng đang kiểm tra tính đầy đủ của hồ sơ.' },
  CHECKED: { code: 'RECEIVED', label: 'Đang kiểm tra hồ sơ', message: 'Ngân hàng đang kiểm tra tính đầy đủ của hồ sơ.' },
  SUPPLEMENT_REQUIRED: { code: 'SUPPLEMENT_REQUIRED', label: 'Cần bổ sung chứng từ', message: 'Ngân hàng cần bổ sung chứng từ. Vui lòng mở mục "Bổ sung hồ sơ sau tiếp nhận" để gửi tài liệu.' },
  PENDING_APPRAISAL: { code: 'APPRAISAL', label: 'Đang thẩm định', message: 'Hồ sơ đang được thẩm định.' },
  WAITING_HEAD_OFFICE: { code: 'HEAD_OFFICE', label: 'Đang chờ cấp có thẩm quyền xét duyệt', message: 'Hồ sơ đang được trình cấp có thẩm quyền xem xét.' },
  APPROVED: { code: 'APPROVED', label: 'Đã được phê duyệt', message: 'Hồ sơ đã được phê duyệt. Ngân hàng sẽ liên hệ về các bước tiếp theo.' },
  REJECTED: { code: 'REJECTED', label: 'Không được chấp thuận', message: 'Hồ sơ không được chấp thuận.' },
  CLOSED_TIMEOUT: { code: 'CLOSED', label: 'Đã đóng do quá hạn bổ sung', message: 'Hồ sơ đã được đóng do quá hạn bổ sung chứng từ. Vui lòng liên hệ ngân hàng để được hướng dẫn.' },
};

function steps(states: StepState[]) {
  return STEP_CODES.map((code, index) => ({ code, label: STEP_LABELS[index], state: states[index] }));
}

function loanSteps(loan: TrackingLoan): StepState[] {
  const finished = Boolean(loan.completedAt) || loan.currentStage === 'HOAN_TAT';
  if (!finished) {
    const at = Math.max(0, STAGE_ORDER.indexOf(loan.currentStage));
    return STEP_CODES.map((_, index) => (index < at ? 'done' : index === at ? 'current' : 'pending'));
  }
  if (loan.currentStatus === 'APPROVED') return ['done', 'done', 'done', 'done'];
  // Bị từ chối hoặc đóng: các công đoạn đã đi qua là hoàn thành, các bước còn lại chưa tới, bước cuối dừng.
  const visited = (loan.stageHistories ?? []).map(item => STAGE_ORDER.indexOf(item.stage.stageCode)).filter(index => index >= 0);
  const reached = visited.length ? Math.max(...visited) : 0;
  return STEP_CODES.map((_, index) => (index === 3 ? 'stopped' : index <= reached ? 'done' : 'pending'));
}

export function buildTracking(request: TrackingRequest, loan?: TrackingLoan | null) {
  const base = {
    requestId: request.id,
    reference: request.reference,
    submittedAt: request.submittedAt ?? null,
    acceptedAt: request.acceptedAt ?? null,
  };
  if (!loan) {
    const pre = PRE_ACCEPTANCE[request.status] ?? PRE_ACCEPTANCE.SUBMITTED;
    const code = PRE_ACCEPTANCE[request.status] ? request.status : 'SUBMITTED';
    const state: StepState = request.status === 'DRAFT' ? 'pending' : 'current';
    return { ...base, status: { code, ...pre }, steps: steps([state, 'pending', 'pending', 'pending']) };
  }
  const status = LOAN_STATUS[loan.currentStatus] ?? LOAN_STATUS.RECEIVED;
  const result: any = { ...base, status: { ...status }, steps: steps(loanSteps(loan)) };
  if (loan.currentStatus === 'REJECTED') {
    const code = loan.rejectionReasonCode && PUBLIC_REJECTION_REASONS[loan.rejectionReasonCode] ? loan.rejectionReasonCode : null;
    result.rejection = { code, label: code ? PUBLIC_REJECTION_REASONS[code] : GENERIC_REJECTION };
  }
  return result;
}
