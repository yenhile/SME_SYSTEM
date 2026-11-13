export interface RateBand { id: string; minRate: number; maxRate: number; effectiveFrom: string; basis: string }
export interface RateBandRow extends RateBand { loanType: string; createdBy: string; createdAt: string }
export interface RateBandList { items: RateBandRow[]; active: Record<string, RateBand | null> }
export interface RateBandForm { loanType: string; minRate: string; maxRate: string; effectiveDate: string; basis: string }

export const LOAN_TYPE_NAMES: Record<string, string> = { VAY_VON_LUU_DONG: 'Vốn lưu động', VAY_DAU_TU_TSCD: 'Đầu tư tài sản cố định', THAU_CHI: 'Thấu chi' };
export const EMPTY_BAND_FORM: RateBandForm = { loanType: '', minRate: '', maxRate: '', effectiveDate: '', basis: '' };

const RATE_TEXT = /^\d{1,3}(\.\d{1,2})?$/;
const VN_OFFSET_MS = 7 * 3600 * 1000;

function rateOf(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  return RATE_TEXT.test(normalized) && Number(normalized) <= 100 ? Number(normalized) : null;
}
const percent = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export const rangeText = (min: number, max: number) => `${percent(min)}–${percent(max)}%/năm`;
export const dayText = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
const inputDayText = (day: string) => day.split('-').reverse().join('/');

export const vnToday = (now: Date = new Date()) => new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);

/** Cùng quy tắc với backend: sàn lớn hơn 0, sàn không vượt trần, trần tối đa 100, ngày hiệu lực không trước hôm nay. */
export function bandFormError(form: RateBandForm, today: string): string | null {
  if (!LOAN_TYPE_NAMES[form.loanType]) return 'Chọn loại vay.';
  const min = rateOf(form.minRate);
  if (min === null || min <= 0) return 'Sàn phải lớn hơn 0 và tối đa 100%/năm, tối đa 2 chữ số thập phân.';
  const max = rateOf(form.maxRate);
  if (max === null) return 'Trần phải từ 0 đến 100%/năm, tối đa 2 chữ số thập phân.';
  if (min > max) return 'Sàn phải không lớn hơn trần.';
  if (!form.effectiveDate) return 'Chọn ngày hiệu lực.';
  if (form.effectiveDate < today) return 'Ngày hiệu lực không được trước hôm nay.';
  if (!form.basis.trim()) return 'Nhập căn cứ ban hành.';
  return null;
}

export function bandPayload(form: RateBandForm) {
  return { loanType: form.loanType, minRate: rateOf(form.minRate), maxRate: rateOf(form.maxRate), effectiveDate: form.effectiveDate, basis: form.basis.trim() };
}

export function bandConfirmText(form: RateBandForm, current: RateBand | null, today: string): string {
  const when = form.effectiveDate === today ? 'hiệu lực ngay khi lưu' : `hiệu lực từ ${inputDayText(form.effectiveDate)}`;
  const now = current ? `Khung đang áp dụng: ${rangeText(current.minRate, current.maxRate)}.` : 'Loại vay này chưa có khung đang áp dụng.';
  return `Thêm khung ${LOAN_TYPE_NAMES[form.loanType]} ${rangeText(rateOf(form.minRate)!, rateOf(form.maxRate)!)}, ${when}?\n${now} Phiên bản đã lưu không sửa hay xóa được.`;
}
