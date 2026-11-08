// Tùy chọn giao diện của người dùng, lưu trên trình duyệt (không gửi lên máy chủ). Hàm thuần để kiểm thử được.
export const FONT_SCALES = [
  { value: 100, label: 'Vừa (mặc định)' },
  { value: 112, label: 'Lớn' },
  { value: 125, label: 'Rất lớn' },
] as const;

export interface UserPreferences { fontScale: number }
export const DEFAULT_PREFERENCES: UserPreferences = { fontScale: 100 };
export const PREFERENCES_KEY = 'sme_ui_prefs';

export function normalizePreferences(value: unknown): UserPreferences {
  const scale = Number((value as Partial<UserPreferences> | null)?.fontScale);
  return { fontScale: FONT_SCALES.some(item => item.value === scale) ? scale : DEFAULT_PREFERENCES.fontScale };
}

type ReadStore = { getItem(key: string): string | null };
type WriteStore = { setItem(key: string, value: string): void };
const browserStore = (): Storage | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage);

export function loadPreferences(storage: ReadStore | undefined = browserStore()): UserPreferences {
  try {
    const raw = storage?.getItem(PREFERENCES_KEY);
    return normalizePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: UserPreferences, storage: WriteStore | undefined = browserStore()): void {
  try {
    storage?.setItem(PREFERENCES_KEY, JSON.stringify(normalizePreferences(preferences)));
  } catch {
    /* trình duyệt chặn lưu: tùy chọn chỉ áp dụng cho phiên này */
  }
}

/** Cỡ chữ gốc của trang; mọi kích thước tính theo rem đi theo. */
export function applyPreferences(preferences: UserPreferences, root: { style: { fontSize: string } } | undefined = typeof document === 'undefined' ? undefined : document.documentElement): void {
  if (root) root.style.fontSize = preferences.fontScale === 100 ? '' : `${preferences.fontScale}%`;
}
