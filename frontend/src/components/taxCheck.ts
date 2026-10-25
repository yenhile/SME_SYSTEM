import type { Company } from '../types';

export interface TaxCheckResult { found: boolean; restricted?: boolean; company: Company | null }

/** Kết quả tra MST khi tạo hồ sơ. Doanh nghiệp của cán bộ khác chỉ báo "đã tồn tại", không điền sẵn thông tin. */
export function describeTaxCheck(result: TaxCheckResult): { company: Company | null; text: string; type: 'success' | 'error'; blocked: boolean } {
  if (result.restricted) {
    return {
      company: null,
      type: 'error',
      blocked: true,
      text: 'Mã số thuế đã tồn tại trong hệ thống nhưng không thuộc hồ sơ do bạn phụ trách nên thông tin bị ẩn và bạn không thể tạo hồ sơ cho doanh nghiệp này. Vui lòng liên hệ Quản lý chi nhánh.',
    };
  }
  if (result.company) return { company: result.company, type: 'success', blocked: false, text: 'Đã tìm thấy thông tin doanh nghiệp trong hệ thống' };
  return { company: null, type: 'success', blocked: false, text: 'Doanh nghiệp mới - vui lòng nhập thông tin bên dưới' };
}
