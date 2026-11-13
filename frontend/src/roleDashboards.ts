import type { OperationsRow } from './operationsDashboard';

export interface OfficerDashboardData {
  generatedAt: string;
  kpis: { assigned: number; myTurn: number; overdue: number; mlFlagged: number };
  sla: { onTime: number; dueSoon: number; overdue: number; paused: number; unknown: number };
  statusDistribution: { status: string; count: number }[];
  completionTrend: { month: string; completed: number }[];
  tasks: { items: (OperationsRow & { task: string })[]; total: number; page: number; pageSize: number };
}

export interface ApproverDashboardData {
  generatedAt: string;
  kpis: { waiting: number; overdue: number; dueSoon: number; decided: { days: number; total: number; mine: number } };
  queueSla: { onTime: number; dueSoon: number; overdue: number; paused: number; unknown: number };
  waitByLoanType: { loanType: string; count: number; avgWorkHours: number | null }[];
  decisionTrend: { month: string; approved: number; rejected: number }[];
}

export interface AdminDashboardData {
  generatedAt: string;
  accounts: { total: number; active: number; locked: number };
  byRole: { code: string; name: string; active: number; locked: number }[];
  activity: { day: string; count: number }[];
  activityTotal: number;
}

/** Việc CBTD làm tiếp theo, đúng các bước workflow hiện có. */
export const OFFICER_TASK_LABELS: Record<string, string> = {
  INTAKE_CHECK: 'Kiểm tra chứng từ tiếp nhận',
  INTAKE_FORWARD: 'Chuyển sang Thẩm định',
  NO_REPORT: 'Lập và trình tờ trình',
  CLARIFICATION: 'Làm rõ theo yêu cầu Thẩm quyền',
  EVIDENCE_CHANGED: 'Trình lại tờ trình (căn cứ đã đổi)',
  CONFLICT: 'Theo dõi đề nghị xung đột lợi ích',
};

/** Màu cho trạng thái hồ sơ trên biểu đồ tỷ trọng: theo thứ tự phân loại cố định, trạng thái kết thúc dùng màu trạng thái. */
export const STATUS_COLORS: Record<string, string> = {
  RECEIVED: '#2a78d6', CHECKED: '#1baf7a', SUPPLEMENT_REQUIRED: '#eb6834', PENDING_APPRAISAL: '#6250d6',
  APPROVED: '#0ca30c', REJECTED: '#d03b3b', CLOSED_TIMEOUT: '#8a94a6',
};

export const officerQuery = (page: number) => `/dashboard/officer?page=${page}&pageSize=10`;
export const approverQueueQuery = (page: number) => `/loan-applications?queue=DECIDE&page=${page}&pageSize=10`;

const LOAN_TYPES: Record<string, string> = { VAY_VON_LUU_DONG: 'Vốn lưu động', VAY_DAU_TU_TSCD: 'Đầu tư tài sản cố định', THAU_CHI: 'Thấu chi' };
export const loanTypeName = (code: string) => LOAN_TYPES[code] ?? code;

/** Thời điểm trình của bản tờ trình mới nhất; hồ sơ quy trình cũ không có tờ trình. */
export function submittedText(version: { sequence: number; submittedAt: string } | null | undefined, format: (iso: string) => string): string {
  return version ? `${format(version.submittedAt)} · bản ${version.sequence}` : 'Quy trình cũ, không có tờ trình';
}
