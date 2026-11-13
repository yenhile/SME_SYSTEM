// Tổng hợp cho trang chủ doanh nghiệp: số đề nghị theo trạng thái, việc cần làm ngay và kết quả cuối cùng. Hàm thuần, không phụ thuộc React.

export interface HomeRequest { id: string; reference: string; status: 'DRAFT' | 'SUBMITTED' | 'ASSIGNED' | 'RETURNED' | 'ACCEPTED'; loanId?: string; data: { companyName?: string; proposedAmount?: number | string } }
export interface HomeOutcome { status: { code: string; label: string; message: string }; rejection?: { label: string } }

export interface HomeAction { kind: 'RETURNED' | 'SUPPLEMENT' | 'DRAFT'; requestId: string; reference: string; text: string }
export interface HomeResult { requestId: string; reference: string; company: string; code: 'APPROVED' | 'REJECTED' | 'CLOSED'; label: string; detail: string }
export interface HomeSummary {
  counts: { draft: number; waitingBank: number; returned: number; inProgress: number; decided: number };
  actions: HomeAction[];
  results: HomeResult[];
}

const FINAL = ['APPROVED', 'REJECTED', 'CLOSED'] as const;
const isFinal = (code?: string): code is (typeof FINAL)[number] => !!code && (FINAL as readonly string[]).includes(code);

export function summarizeHome(requests: HomeRequest[], supplementCounts: Record<string, number>, outcomes: Record<string, HomeOutcome | undefined>): HomeSummary {
  const counts = { draft: 0, waitingBank: 0, returned: 0, inProgress: 0, decided: 0 };
  const returned: HomeAction[] = [], supplements: HomeAction[] = [], drafts: HomeAction[] = [], results: HomeResult[] = [];
  for (const item of requests) {
    const outcome = outcomes[item.id];
    if (item.status === 'DRAFT') { counts.draft++; drafts.push({ kind: 'DRAFT', requestId: item.id, reference: item.reference, text: 'Bản nháp chưa gửi — tiếp tục khai và tải tài liệu.' }); }
    else if (item.status === 'RETURNED') { counts.returned++; returned.push({ kind: 'RETURNED', requestId: item.id, reference: item.reference, text: 'Ngân hàng yêu cầu chỉnh sửa đề nghị — sửa và gửi lại trên cùng mã.' }); }
    else if (item.status === 'SUBMITTED' || item.status === 'ASSIGNED') counts.waitingBank++;
    else if (item.status === 'ACCEPTED') {
      if (isFinal(outcome?.status.code)) {
        counts.decided++;
        const code = outcome!.status.code as HomeResult['code'];
        results.push({ requestId: item.id, reference: item.reference, company: item.data.companyName || 'Chưa nhập tên doanh nghiệp', code, label: outcome!.status.label, detail: outcome!.rejection?.label ?? outcome!.status.message });
      } else {
        counts.inProgress++;
        const pending = supplementCounts[item.id] ?? 0;
        if (pending > 0) supplements.push({ kind: 'SUPPLEMENT', requestId: item.id, reference: item.reference, text: `${pending} yêu cầu bổ sung chứng từ đang chờ doanh nghiệp.` });
      }
    }
  }
  return { counts, actions: [...returned, ...supplements, ...drafts], results };
}

export type ListFilter = 'ALL' | 'ACTION' | 'DRAFT' | 'WAITING' | 'PROCESSING' | 'DECIDED';
export const LIST_FILTERS: ReadonlyArray<readonly [ListFilter, string]> = [
  ['ALL', 'Tất cả'], ['ACTION', 'Cần doanh nghiệp xử lý'], ['DRAFT', 'Bản nháp'], ['WAITING', 'Chờ ngân hàng tiếp nhận'], ['PROCESSING', 'Đang thẩm định'], ['DECIDED', 'Đã có kết quả'],
];

/** Nhóm của một đề nghị trên danh sách: việc doanh nghiệp phải làm được tách khỏi việc đang chờ ngân hàng. */
export function listGroup(item: HomeRequest, supplementCounts: Record<string, number>, outcomes: Record<string, HomeOutcome | undefined>): Exclude<ListFilter, 'ALL'> {
  if (item.status === 'DRAFT') return 'DRAFT';
  if (item.status === 'RETURNED') return 'ACTION';
  if (item.status === 'SUBMITTED' || item.status === 'ASSIGNED') return 'WAITING';
  if (isFinal(outcomes[item.id]?.status.code)) return 'DECIDED';
  return (supplementCounts[item.id] ?? 0) > 0 ? 'ACTION' : 'PROCESSING';
}

export function listCounts(requests: HomeRequest[], supplementCounts: Record<string, number>, outcomes: Record<string, HomeOutcome | undefined>): Record<ListFilter, number> {
  const counts: Record<ListFilter, number> = { ALL: requests.length, ACTION: 0, DRAFT: 0, WAITING: 0, PROCESSING: 0, DECIDED: 0 };
  for (const item of requests) counts[listGroup(item, supplementCounts, outcomes)]++;
  return counts;
}
