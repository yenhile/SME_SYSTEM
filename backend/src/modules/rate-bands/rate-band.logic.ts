import { BadRequestException } from '@nestjs/common';
import { LoanType, Prisma } from '@prisma/client';
import { isValidRate } from '../appraisal/appraisal.logic';

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  VAY_VON_LUU_DONG: 'Vốn lưu động',
  VAY_DAU_TU_TSCD: 'Đầu tư tài sản cố định',
  THAU_CHI: 'Thấu chi',
};
const BASIS_MAX = 500;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VN_OFFSET_MS = 7 * 3600 * 1000;

export const loanTypeLabel = (loanType: string) => LOAN_TYPE_LABELS[loanType as LoanType] ?? loanType;
const rateNumber = (value: unknown) => Number(value);
const percent = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export interface RateBandRow {
  id: string;
  loanType?: string;
  termFromMonths?: number | null;
  termToMonths?: number | null;
  minRate: Prisma.Decimal | number | string;
  maxRate: Prisma.Decimal | number | string;
  effectiveFrom: Date;
  createdAt?: Date;
  basis: string;
}
export type RateBandView = { id: string; minRate: number; maxRate: number; effectiveFrom: string; basis: string };
export interface RateBandInput { loanType: unknown; minRate: unknown; maxRate: unknown; effectiveDate: unknown; basis: unknown }

export function bandView(band: RateBandRow | null | undefined): RateBandView | null {
  if (!band) return null;
  return { id: band.id, minRate: rateNumber(band.minRate), maxRate: rateNumber(band.maxRate), effectiveFrom: band.effectiveFrom.toISOString(), basis: band.basis };
}

const vnDayStart = (date: Date) => {
  const local = new Date(date.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - VN_OFFSET_MS);
};

/** Ngày hiệu lực tính theo giờ Việt Nam, không được lùi về trước hôm nay; chọn hôm nay thì khung có hiệu lực ngay lúc lưu. */
export function parseBandInput(input: RateBandInput, now: Date) {
  if (!Object.hasOwn(LOAN_TYPE_LABELS, String(input.loanType))) throw new BadRequestException('Loại vay không hợp lệ.');
  const loanType = input.loanType as LoanType;
  if (!isValidRate(input.minRate) || input.minRate <= 0) throw new BadRequestException('Sàn phải lớn hơn 0 và tối đa 100%/năm, tối đa 2 chữ số thập phân.');
  if (!isValidRate(input.maxRate)) throw new BadRequestException('Trần phải từ 0 đến 100%/năm, tối đa 2 chữ số thập phân.');
  if (input.minRate > input.maxRate) throw new BadRequestException('Sàn phải không lớn hơn trần.');
  const basis = typeof input.basis === 'string' ? input.basis.trim() : '';
  if (!basis || basis.length > BASIS_MAX) throw new BadRequestException(`Căn cứ ban hành bắt buộc, tối đa ${BASIS_MAX} ký tự.`);
  const text = typeof input.effectiveDate === 'string' ? input.effectiveDate : '';
  const [y, m, d] = DAY.test(text) ? text.split('-').map(Number) : [NaN, NaN, NaN];
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(utc.getTime()) || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) throw new BadRequestException('Hiệu lực từ phải là ngày hợp lệ dạng YYYY-MM-DD.');
  const dayStart = new Date(utc.getTime() - VN_OFFSET_MS);
  const today = vnDayStart(now);
  if (dayStart < today) throw new BadRequestException('Ngày hiệu lực không được trước hôm nay.');
  return { loanType, minRate: input.minRate, maxRate: input.maxRate, effectiveFrom: dayStart.getTime() === today.getTime() ? now : dayStart, basis };
}

const coversTerm = (band: RateBandRow, termMonths: number) =>
  (band.termFromMonths == null || band.termFromMonths <= termMonths) && (band.termToMonths == null || band.termToMonths >= termMonths);

export function selectActiveBand(bands: RateBandRow[], { loanType, termMonths, at }: { loanType: string; termMonths: number; at: Date }): RateBandRow | null {
  const candidates = bands
    .filter(band => band.loanType === loanType && band.effectiveFrom <= at && coversTerm(band, termMonths))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return candidates[0] ?? null;
}

export function findActiveBand(db: Pick<Prisma.TransactionClient, 'interestRateBand'>, loanType: LoanType, termMonths: number, at: Date) {
  return db.interestRateBand.findFirst({
    where: {
      loanType,
      effectiveFrom: { lte: at },
      AND: [
        { OR: [{ termFromMonths: null }, { termFromMonths: { lte: termMonths } }] },
        { OR: [{ termToMonths: null }, { termToMonths: { gte: termMonths } }] },
      ],
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });
}

export function assertRateInBand(rate: number, band: RateBandRow | null, loanType: string, subject: string) {
  if (!band) throw new BadRequestException(`Chưa có khung lãi suất hiệu lực cho loại vay ${loanTypeLabel(loanType)}. Liên hệ Admin cấu hình khung.`);
  const min = rateNumber(band.minRate), max = rateNumber(band.maxRate);
  if (rate < min || rate > max) throw new BadRequestException(`${subject} phải trong khung ${percent(min)}–${percent(max)}%/năm của loại vay ${loanTypeLabel(loanType)}.`);
}
