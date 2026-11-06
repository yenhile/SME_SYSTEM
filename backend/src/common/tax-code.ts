import { BadRequestException } from '@nestjs/common';

export const TAX_CODE_PATTERN = /^(\d{10}|\d{13})$/;
export const TAX_CODE_MESSAGE = 'Mã số thuế phải có 10 hoặc 13 chữ số.';

export function assertTaxCode(taxCode: unknown): void {
  if (typeof taxCode !== 'string' || !TAX_CODE_PATTERN.test(taxCode)) throw new BadRequestException(TAX_CODE_MESSAGE);
}
