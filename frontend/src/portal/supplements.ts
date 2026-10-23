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
export function supplementError(error: unknown) {
  const value = error as { message?: string; status?: number };
  return `${value?.message || 'Thao tác thất bại. Vui lòng thử lại.'}${value?.status === 409 ? ' Dữ liệu đã thay đổi; tải lại yêu cầu trước khi thử lại.' : ''}`;
}
