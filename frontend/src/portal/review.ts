import type { PortalChecklist } from './model';
import type { WizardIssue } from './wizard';

const fields: Record<string, [string, number]> = {
  companyName: ['Tên doanh nghiệp', 1], taxCode: ['Mã số thuế', 1], companyType: ['Loại hình doanh nghiệp', 1],
  industry: ['Ngành nghề hoạt động', 1], establishedDate: ['Ngày thành lập', 1], establishedYear: ['Năm thành lập', 1],
  address: ['Địa chỉ trụ sở', 1], representativeName: ['Người đại diện pháp luật', 1], phone: ['Điện thoại doanh nghiệp', 1],
  contactName: ['Người liên hệ', 1], contactPosition: ['Chức vụ người liên hệ', 1], contactPhone: ['Điện thoại liên hệ', 1],
  contactEmail: ['Email liên hệ', 1], annualRevenue: ['Doanh thu năm', 1], revenuePeriod: ['Năm báo cáo doanh thu', 1],
  charterCapital: ['Vốn điều lệ', 1], businessScope: ['Phạm vi hoạt động', 1], serviceProofMode: ['Căn cứ doanh thu dịch vụ', 1],
  'representative.mode': ['Tư cách người gửi', 1], 'representative.name': ['Họ tên người được ủy quyền', 1],
  loanType: ['Loại khoản vay', 2], proposedAmount: ['Số tiền đề nghị', 2], loanPurpose: ['Mục đích vay', 2],
  loanTermMonths: ['Thời hạn vay', 2], neededAt: ['Thời điểm cần vốn', 2], preferredBranch: ['Chi nhánh mong muốn', 2],
  hasExistingDebt: ['Thông tin dư nợ hiện tại', 2], collateral: ['Thông tin bảo đảm', 2],
  'collateral.mode': ['Hình thức bảo đảm dự kiến', 2], 'collateral.description': ['Mô tả tài sản bảo đảm', 2],
  capitalPlan: ['Phương án sử dụng vốn', 3], 'capitalPlan.businessActivity': ['Hoạt động cần tài trợ', 3],
  'capitalPlan.ownFunds': ['Vốn tự có', 3], 'capitalPlan.otherFunds': ['Nguồn vốn khác', 3],
  'capitalPlan.otherFundsSource': ['Mô tả nguồn vốn khác', 3], 'capitalPlan.useFrom': ['Ngày bắt đầu sử dụng vốn', 3],
  'capitalPlan.useTo': ['Ngày kết thúc sử dụng vốn', 3], 'capitalPlan.repaymentSource': ['Nguồn trả nợ', 3],
  'capitalPlan.recoveryDate': ['Ngày thu hồi vốn dự kiến', 3],
  annualRevenueBasis: ['Nguồn doanh thu năm', 4], 'annualRevenueBasis.documentId': ['Tài liệu nguồn doanh thu', 4],
  'annualRevenueBasis.fullYearCompleted': ['Xác nhận năm báo cáo hoàn thành', 4],
  'submissionDeclaration.accepted': ['Xác nhận cam kết của người gửi', 5],
  'submissionDeclaration.version': ['Nội dung cam kết của người gửi', 5],
};

export function reviewField(path: string) {
  const entry = fields[path];
  if (entry) return { label: entry[0], step: entry[1] };
  if (path.startsWith('capitalPlan.costs')) return { label: 'Hạng mục chi phí', step: 3 };
  return { label: '', step: 5 };
}

function displayMessage(message: string) {
  let text = message;
  for (const key of Object.keys(fields).sort((a, b) => b.length - a.length)) text = text.split(key).join(fields[key][0]);
  return /[a-z]+[A-Z][a-zA-Z]*|[A-Za-z_]\w*\.[A-Za-z_]|\b[A-Z]+_[A-Z_]+\b/.test(text)
    ? 'Một thông tin cần được kiểm tra lại. Hãy xem các phần hồ sơ hoặc tải lại kết quả kiểm tra.' : text;
}

export interface ReviewNotice { path: string; step: number; message: string; severity: 'error' | 'warning' }
export function reviewNotices(checklist?: Pick<PortalChecklist, 'approvedIntakeAssessment' | 'formErrors' | 'missing'> | null, draft: WizardIssue[] = []): ReviewNotice[] {
  const rows = new Map<string, ReviewNotice>();
  const add = (path: string, message: string, severity: ReviewNotice['severity'] = 'error', fallbackStep = 5) => {
    const canonical = path.startsWith('submissionDeclaration.') ? 'submissionDeclaration.accepted' : path;
    const known = reviewField(canonical);
    const old = rows.get(canonical);
    if (old && (old.severity === 'error' || severity === 'warning')) return;
    rows.set(canonical, { path: canonical, step: known.label ? known.step : fallbackStep, message: displayMessage(message), severity });
  };
  const assessment = checklist?.approvedIntakeAssessment;
  for (const issue of assessment?.issues ?? []) add(issue.path, issue.message, 'error', issue.step);
  for (const message of [...(assessment?.formErrors ?? []), ...(checklist?.formErrors ?? [])]) {
    const match = /^Thiếu thông tin(?: điều kiện)?:\s*(.+)$/.exec(message);
    const path = match?.[1]?.trim();
    const field = path ? reviewField(path) : null;
    if (path && field?.label) add(path, `Vui lòng bổ sung ${field.label.toLocaleLowerCase('vi-VN')}.`);
    else add(path ?? `general:${message}`, path ? 'Một thông tin cần được kiểm tra lại. Hãy xem các phần hồ sơ hoặc tải lại kết quả kiểm tra.' : message);
  }
  for (const item of assessment?.requirements ?? []) if (item.state === 'MISSING') add(`document:${item.id}`, `Cần cung cấp: ${item.label}.`, 'error', 4);
  if (!assessment) for (const id of checklist?.missing ?? []) add(`document:${id}`, 'Cần bổ sung tài liệu theo danh mục của đề nghị.', 'error', 4);
  for (const issue of draft) add(issue.path, issue.message, issue.severity, issue.step);
  return [...rows.values()].sort((a, b) => a.step - b.step);
}

export interface ReviewState {
  editable: boolean; enabled: boolean; busy: boolean; conflict: boolean; pendingFiles: number; dirty: boolean;
  fresh: boolean; hasAssessment: boolean; submitDisabled: boolean; checkError: boolean;
}
export function reviewStatus(state: ReviewState): { tone: 'ready' | 'pending' | 'error' | 'readonly'; title: string; message: string } {
  if (!state.editable) return { tone: 'readonly', title: 'Đề nghị đang ở chế độ xem', message: 'Bạn có thể xem lại thông tin và theo dõi việc xử lý đề nghị.' };
  if (state.conflict) return { tone: 'error', title: 'Cần đối chiếu bản nháp', message: 'Có phiên bản khác của đề nghị. Đối chiếu nội dung trước khi lưu tiếp.' };
  if (!state.enabled) return { tone: 'pending', title: 'Chưa mở gửi đề nghị', message: 'Bạn vẫn có thể chuẩn bị và lưu nháp. Hệ thống hiện chưa mở gửi đề nghị này.' };
  if (state.checkError) return { tone: 'error', title: 'Chưa kiểm tra được hồ sơ', message: 'Không tải được kết quả kiểm tra. Hãy thử tải lại; nội dung đã lưu vẫn được giữ.' };
  if (state.busy) return { tone: 'pending', title: 'Đang xử lý đề nghị', message: 'Vui lòng chờ hoàn tất trước khi thực hiện thao tác tiếp theo.' };
  if (state.pendingFiles > 0) return { tone: 'pending', title: 'Tài liệu chưa tải lên hoàn tất', message: `Còn ${state.pendingFiles} tệp trong hàng chờ. Quay lại bước 4 để hoàn tất tải lên.` };
  if (state.dirty) return { tone: 'pending', title: 'Có nội dung chưa lưu', message: 'Bấm Lưu nháp để kiểm tra nội dung mới nhất, kể cả sau khi xác nhận cam kết.' };
  if (!state.fresh || !state.hasAssessment) return { tone: 'pending', title: 'Chờ kết quả kiểm tra', message: 'Chưa có kết quả kiểm tra cho bản lưu hiện tại. Chưa thể xác nhận đề nghị sẵn sàng gửi.' };
  if (state.submitDisabled) return { tone: 'pending', title: 'Đề nghị cần được hoàn thiện', message: 'Xem các mục cần bổ sung bên dưới trước khi gửi đề nghị.' };
  return { tone: 'ready', title: 'Sẵn sàng gửi đề nghị', message: 'Đã đủ điều kiện gửi theo kiểm tra hiện tại. Ngân hàng vẫn cần kiểm tra nội dung hồ sơ.' };
}
