const TAX_CODE_PATTERN = /^(\d{10}|\d{13})$/;

export const taxCodeError = (value: string): string | null =>
  TAX_CODE_PATTERN.test(value.trim()) ? null : 'Mã số thuế phải có 10 hoặc 13 chữ số.';

const BRANCH_LIMIT = 10_000_000_000;

export function officialAmountError(value: number, proposedAmount: number | string): string | null {
  if (!Number.isFinite(value) || value <= 0) return 'Hạn mức chính thức phải lớn hơn 0.';
  if (value > BRANCH_LIMIT) return 'Hạn mức chính thức tối đa 10 tỷ đồng.';
  if (value > Number(proposedAmount)) return 'Hạn mức chính thức không được vượt số tiền đề xuất.';
  return null;
}

export function documentTypeName(config: { groups: { documentTypes: { code: string; name: string }[] }[] } | null | undefined, code: string): string {
  const types = config?.groups.flatMap(group => group.documentTypes) ?? [];
  const typeCode = code.split(' · ').pop();
  return types.find(type => type.code === typeCode)?.name ?? 'Tài liệu bổ sung';
}

const FORMATS: Record<string, { accept: string; label: string }> = {
  TAI_CHINH: { accept: '.pdf,.xlsx', label: 'PDF hoặc XLSX' },
  DU_NO: { accept: '.pdf,.xlsx', label: 'PDF hoặc XLSX' },
  TSBD: { accept: '.pdf,.jpg,.jpeg,.png', label: 'PDF, JPG hoặc PNG' },
};
const PDF_ONLY = { accept: '.pdf', label: 'PDF' };

export const documentFormat = (documentType: string) => FORMATS[documentType] ?? PDF_ONLY;
