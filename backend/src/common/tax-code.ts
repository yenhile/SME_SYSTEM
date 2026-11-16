import { BadRequestException } from '@nestjs/common';

export const TAX_CODE_PATTERN = /^(\d{10}|\d{13})$/;
export const TAX_CODE_MESSAGE = 'Mã số thuế phải có 10 hoặc 13 chữ số.';

export function assertTaxCode(taxCode: unknown): void {
  if (typeof taxCode !== 'string' || !TAX_CODE_PATTERN.test(taxCode)) throw new BadRequestException(TAX_CODE_MESSAGE);
}

export const TAX_CODE_CHECKSUM_MESSAGE = 'Mã số thuế không hợp lệ: chữ số kiểm tra không khớp. Vui lòng kiểm tra lại mã trên Giấy chứng nhận đăng ký doanh nghiệp.';
const CHECK_WEIGHTS = [31, 29, 23, 19, 17, 13, 7, 5, 3];

/** The 10th digit of a Vietnamese tax code is 10 - (weighted sum of the first nine mod 11); a 13-digit branch code adds a non-zero 3-digit suffix. */
export function hasValidTaxCodeChecksum(taxCode: unknown): boolean {
  if (typeof taxCode !== 'string' || !TAX_CODE_PATTERN.test(taxCode)) return false;
  const check = 10 - CHECK_WEIGHTS.reduce((sum, weight, index) => sum + weight * Number(taxCode[index]), 0) % 11;
  if (check > 9 || check !== Number(taxCode[9])) return false;
  return taxCode.length === 10 || taxCode.slice(10) !== '000';
}

export function assertTaxCodeChecksum(taxCode: unknown): void {
  if (!hasValidTaxCodeChecksum(taxCode)) throw new BadRequestException(TAX_CODE_CHECKSUM_MESSAGE);
}
