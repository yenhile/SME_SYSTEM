import { RoleCode } from '../types';
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const getAuthToken = () => localStorage.getItem('sme_token');
export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem('sme_token', token);
  else localStorage.removeItem('sme_token');
}
export function setActiveRole(role: RoleCode | null) {
  if (role) localStorage.setItem('sme_active_role', role);
  else localStorage.removeItem('sme_active_role');
}
async function request<T>(endpoint: string, options: RequestInit = {}, blob = false): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = getAuthToken();
  const role = localStorage.getItem('sme_active_role');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (role && !endpoint.startsWith('/auth/')) headers.set('X-Active-Role', role);
  const timeoutSignal = AbortSignal.timeout(15_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  try {
    let response: Response;
    try { response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers, signal }); }
    catch { throw new ApiError('Không kết nối được máy chủ. Vui lòng kiểm tra dịch vụ và thử lại.', 0); }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (timeoutSignal.aborted) throw timeoutSignal.reason;
      if (response.status === 401 && endpoint !== '/auth/login') {
        setAuthToken(null); setActiveRole(null);
        window.dispatchEvent(new Event('sme-session-expired'));
      }
      const message = body?.message;
      throw new ApiError(Array.isArray(message) ? message.join('\n') : message || `Yêu cầu thất bại (${response.status}).`, response.status);
    }
    if (response.status === 204) return undefined as T;
    if (blob) return await response.blob() as T;
    return await response.json();
  } catch (error) {
    if (timeoutSignal.aborted) throw new ApiError('Máy chủ phản hồi quá lâu. Vui lòng kiểm tra kết nối và thử lại.', 408);
    throw error;
  }
}
export const api = {
  download: (endpoint: string) => request<Blob>(endpoint, {}, true),
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'POST', body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
