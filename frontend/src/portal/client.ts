const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const PORTAL_TOKEN_KEY = 'sme_portal_token';
export class PortalApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) { super(message); this.name = 'PortalApiError'; this.status = status; this.code = code; }
}
// A tab must never adopt a different account's token while retaining its old form.
let sessionToken = localStorage.getItem(PORTAL_TOKEN_KEY);
let sessionVersion = 0;
export const portalSessionVersion = () => sessionVersion;
export const isPortalSessionCurrent = (version: number) => version === sessionVersion && localStorage.getItem(PORTAL_TOKEN_KEY) === sessionToken;
export function setPortalToken(token: string | null) {
  const previous = sessionToken;
  sessionToken = token; sessionVersion++;
  if (token) localStorage.setItem(PORTAL_TOKEN_KEY, token);
  else if (localStorage.getItem(PORTAL_TOKEN_KEY) === previous) localStorage.removeItem(PORTAL_TOKEN_KEY);
}
const changedError = () => new PortalApiError('Phiên doanh nghiệp đã thay đổi ở tab khác. Vui lòng đăng nhập lại; nội dung nháp được giữ theo tài khoản cũ.', 401, 'PORTAL_SESSION_CHANGED');
export function syncPortalSession() {
  if (localStorage.getItem(PORTAL_TOKEN_KEY) === sessionToken) return true;
  sessionToken = null; sessionVersion++;
  window.dispatchEvent(new Event('sme-portal-session-changed'));
  return false;
}
async function request<T>(path: string, options: RequestInit = {}, blob = false): Promise<T> {
  const protectedRequest = !path.startsWith('/auth/') || path === '/auth/me';
  if (protectedRequest && !syncPortalSession()) throw changedError();
  const version = sessionVersion, token = sessionToken, stored = localStorage.getItem(PORTAL_TOKEN_KEY);
  const assertCurrent = () => {
    if (version === sessionVersion && token === sessionToken && stored === localStorage.getItem(PORTAL_TOKEN_KEY)) return;
    if (version === sessionVersion && token === sessionToken) syncPortalSession();
    throw changedError();
  };
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (protectedRequest && token) headers.set('Authorization', `Bearer ${token}`);
  const signal = AbortSignal.timeout(15000);
  try {
    let response: Response;
    try { response = await fetch(`${BASE_URL}/portal${path}`, { ...options, headers, signal }); }
    catch { throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.'); }
    assertCurrent();
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      assertCurrent();
      if (response.status === 401 && protectedRequest) { setPortalToken(null); window.dispatchEvent(new Event('sme-portal-session-expired')); }
      const message = body?.message;
      throw new PortalApiError(Array.isArray(message) ? message.join('\n') : message || `Yêu cầu thất bại (${response.status}).`, response.status, body?.code);
    }
    if (response.status === 204) return undefined as T;
    const result = await (blob ? response.blob() : response.json()) as T;
    assertCurrent(); return result;
  } catch (error) {
    if (error instanceof PortalApiError) throw error;
    assertCurrent();
    if (signal.aborted) throw new Error('Máy chủ phản hồi quá lâu. Vui lòng thử lại.');
    throw error;
  }
}
export const portalApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string, data?: unknown) => request<T>(path, { method: 'DELETE', body: data === undefined ? undefined : JSON.stringify(data) }),
  download: (path: string) => request<Blob>(path, {}, true),
};
