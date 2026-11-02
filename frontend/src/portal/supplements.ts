import type { GroupCode } from './model';

export interface SupplementItem {
  id: string; documentGroup: GroupCode; documentTypeCode: string; period?: string;
  reason: string; status: 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REPLACE_REQUIRED'; message?: string; reviewedAt?: string;
}
export interface SupplementFile {
  id: string; itemId: string; fileName: string; fileSize: number; mimeType: string;
  version: number; supersedesId?: string; uploadedAt: string; submittedAt?: string;
}
export interface SupplementView {
  id: string; applicationId: string; requestContent: string; status: 'PENDING' | 'RESOLVED';
  requestedAt: string; deadlineAt?: string; resolvedAt?: string; revision: number;
  items: SupplementItem[]; files: SupplementFile[];
  events: { type: string; at: string; itemId?: string; message?: string }[];
}
export interface SupplementDraftItem { documentGroup: GroupCode; documentTypeCode: string; period?: string; reason: string }
export async function loadStaffSupplements(applicationId: string, get: <T>(path: string) => Promise<T>): Promise<SupplementView[]> {
  // Discover IDs afresh: a committed create may have lost its HTTP response.
  // Only the safe detail projection is passed on to the UI.
  const requests = await get<{ id: string }[]>(`/supplements/application/${applicationId}`);
  return Promise.all(requests.map(request => get<SupplementView>(`/supplements/${request.id}/portal-details`)));
}
export function latestFile(view: SupplementView, itemId: string) {
  return view.files.filter(file => file.itemId === itemId).reduce<SupplementFile | undefined>((latest, file) => !latest || file.version > latest.version ? file : latest, undefined);
}
export function currentManifest(view: SupplementView): string[] {
  return view.items.filter(item => item.status === 'PENDING' || item.status === 'REPLACE_REQUIRED').flatMap(item => {
    const file = latestFile(view, item.id);
    return file && !file.submittedAt ? [file.id] : [];
  });
}
export function canRespond(view: SupplementView) {
  const pending = view.items.filter(item => item.status === 'PENDING' || item.status === 'REPLACE_REQUIRED');
  return view.status === 'PENDING' && pending.length > 0 && currentManifest(view).length === pending.length;
}
export function canResolve(view: SupplementView) {
  return view.status === 'PENDING' && view.items.length > 0 && view.items.every(item => item.status === 'ACCEPTED');
}
/** Đã kiểm tra hết các mục, còn mục cần doanh nghiệp sửa và chưa gửi danh sách sửa cho lượt kiểm tra này (C.9.2: gửi danh sách mới dừng SLA chờ doanh nghiệp). */
export function canReturn(view: SupplementView) {
  if (view.status !== 'PENDING' || view.items.some(item => item.status === 'SUBMITTED') || !view.items.some(item => item.status === 'REPLACE_REQUIRED')) return false;
  const lastReturn = view.events.map(event => event.type).lastIndexOf('RETURNED');
  return view.events.slice(lastReturn + 1).some(event => event.type === 'REPLACE_REQUIRED');
}
export function supplementError(error: unknown) {
  const value = error as { message?: string; status?: number };
  return `${value?.message || 'Thao tác thất bại. Vui lòng thử lại.'}${value?.status === 409 ? ' Dữ liệu đã thay đổi; tải lại yêu cầu trước khi thử lại.' : ''}`;
}

/** D4-03: Lọc tập tệp hiện hành theo semantics heads: tệp nào có id nằm trong supersedesId của tệp khác thì bị loại bỏ. */
export function supplementHeads<T extends { id: string; supersedesId?: string }>(files: T[]): T[] {
  const superseded = new Set((files ?? []).map(f => f.supersedesId).filter(Boolean));
  return (files ?? []).filter(f => !superseded.has(f.id));
}

export interface AcceptedSupplementFile {
  id: string;
  supplementId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  version: number;
}

/** D4-03: Trích xuất các tệp bổ sung hiện hành (heads) đã được ngân hàng chấp nhận (ACCEPTED) để hiển thị hợp nhất trong tab Chứng từ, không nhân đôi bảng Document. */
export function extractAcceptedSupplementFiles(supplementRequests?: any[]): AcceptedSupplementFile[] {
  if (!Array.isArray(supplementRequests)) return [];
  const results: AcceptedSupplementFile[] = [];
  for (const supp of supplementRequests) {
    const m = supp.portalSupplement;
    if (!m || !Array.isArray(m.files) || !Array.isArray(m.items)) continue;
    const currentHeads = supplementHeads<SupplementFile>(m.files);
    for (const file of currentHeads) {
      const item = m.items.find((i: any) => i.id === file.itemId);
      if (file.submittedAt && item?.status === 'ACCEPTED') {
        results.push({
          id: file.id,
          supplementId: supp.id,
          documentType: item.documentGroup ? `${item.documentGroup} · ${item.documentTypeCode}${item.period ? ` (${item.period})` : ''}` : 'BỔ SUNG',
          fileName: file.fileName,
          fileSize: file.fileSize,
          uploadedAt: file.uploadedAt || supp.requestedAt,
          version: file.version,
        });
      }
    }
  }
  return results;
}
