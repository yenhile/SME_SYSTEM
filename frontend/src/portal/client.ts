const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const PORTAL_TOKEN_KEY = 'sme_portal_token';
export class PortalApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = 'PortalApiError'; this.status = status; }
}
export function setPortalToken(token: string | null) { if (token) localStorage.setItem(PORTAL_TOKEN_KEY, token); else localStorage.removeItem(PORTAL_TOKEN_KEY); }
async function request<T>(path: string, options: RequestInit = {}, blob = false): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem(PORTAL_TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const signal = AbortSignal.timeout(15000);
  try {
    let response: Response;
    try { response = await fetch(`${BASE_URL}/portal${path}`, { ...options, headers, signal }); }
    catch { throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.'); }
    if (!response.ok) {
      if (response.status === 401 && (!path.startsWith('/auth/') || path === '/auth/me')) { setPortalToken(null); window.dispatchEvent(new Event('sme-portal-session-expired')); }
      const body = await response.json().catch(() => null);
      const message = body?.message;
      throw new PortalApiError(Array.isArray(message) ? message.join('\n') : message || `Yêu cầu thất bại (${response.status}).`, response.status);
    }
    if (response.status === 204) return undefined as T;
    return await (blob ? response.blob() : response.json()) as T;
  } catch (error) {
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
