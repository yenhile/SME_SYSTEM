import { BadRequestException } from '@nestjs/common';
import { CalendarCoverageError, PauseInterval, SIMULATED_CALENDAR_V1, SlaCalendar, workingHoursBetween, workingMillisBetween } from './working-time';

export const SLA_POLICY_PA1 = 'PA1';

/** Các phiên bản lịch đã được phê duyệt dùng cho PA1. Thêm lịch mới = thêm vào đây rồi ghi nhận mốc kích hoạt mới. */
const CALENDARS: Record<string, SlaCalendar> = {
  [SIMULATED_CALENDAR_V1.version]: SIMULATED_CALENDAR_V1,
};

export function calendarByVersion(version: string): SlaCalendar {
  const calendar = CALENDARS[version];
  if (!calendar) throw new BadRequestException(`Không tìm thấy phiên bản lịch SLA ${version}.`);
  return calendar;
}

/** Cách tính áp dụng cho một công đoạn, được chốt lúc mở công đoạn và lưu trên bản ghi lịch sử. */
export interface StageSlaMode {
  slaPolicy: string | null;
  slaCalendarVersion: string | null;
}

export const LEGACY_SLA: StageSlaMode = { slaPolicy: null, slaCalendarVersion: null };

/** Chỉ cần đọc được mốc kích hoạt; cho phép truyền cả PrismaService lẫn transaction client. */
interface ActivationReader {
  slaPolicyActivation: { findFirst(args: any): Promise<{ policyCode: string; calendarVersion: string; activatedAt: Date } | null> };
}

/**
 * Chốt cách tính cho công đoạn sắp mở tại thời điểm `now`: mốc kích hoạt gần nhất có hiệu lực (activatedAt <= now) quyết định.
 * Chưa có mốc nào, hoặc mốc ở tương lai → cách tính cũ. Công đoạn đang mở không bao giờ bị đổi cách tính sau đó.
 * Với PA1 và công đoạn cần đo thời gian (`requireCoverage`), thời điểm mở phải nằm trong kỳ bao phủ của lịch;
 * nếu không thì từ chối thay vì lặng lẽ quay về tính 24/7.
 */
export async function resolveStageSla(db: ActivationReader, now: Date, requireCoverage = true): Promise<StageSlaMode> {
  const activation = await db.slaPolicyActivation.findFirst({ where: { activatedAt: { lte: now } }, orderBy: { activatedAt: 'desc' } });
  if (!activation || activation.policyCode !== SLA_POLICY_PA1) return LEGACY_SLA;
  const calendar = calendarByVersion(activation.calendarVersion);
  if (requireCoverage) {
    try {
      workingMillisBetween(now, new Date(now.getTime() + 1), calendar);
    } catch (error) {
      if (error instanceof CalendarCoverageError) throw new BadRequestException(error.message);
      throw error;
    }
  }
  return { slaPolicy: SLA_POLICY_PA1, slaCalendarVersion: activation.calendarVersion };
}

interface PauseReader {
  applicationStagePause: { findMany(args: any): Promise<Array<{ startedAt: Date; endedAt: Date | null }>> };
}

/** Các khoảng tạm dừng của công đoạn PA1; công đoạn tính theo cách cũ không dùng bảng này. */
export async function loadPauseIntervals(db: PauseReader, historyId: string, slaPolicy: string | null): Promise<PauseInterval[]> {
  if (slaPolicy !== SLA_POLICY_PA1) return [];
  const rows = await db.applicationStagePause.findMany({ where: { historyId }, orderBy: { startedAt: 'asc' } });
  return rows.map(row => ({ start: row.startedAt, end: row.endedAt }));
}

interface PauseWriter {
  applicationStageHistory: { findFirst(args: any): Promise<any>; update(args: any): Promise<any> };
  applicationStagePause: {
    findFirst(args: any): Promise<any>;
    create(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
  };
}

async function openStageOf(db: PauseWriter, applicationId: string) {
  return db.applicationStageHistory.findFirst({ where: { applicationId, exitedAt: null }, orderBy: { enteredAt: 'desc' } });
}

/**
 * Bắt đầu khoảng chờ doanh nghiệp cho công đoạn PA1 đang mở. Công đoạn tính theo cách cũ không dùng bảng này (đường tạm dừng cũ giữ nguyên).
 * Gọi lặp an toàn: đã có khoảng đang mở thì không tạo thêm. Trả true khi vừa tạo khoảng mới.
 * Phải gọi trong giao dịch đã khóa hồ sơ; chỉ mục duy nhất ở DB là lớp bảo vệ cuối chống hai khoảng dừng cùng mở.
 */
export async function openStagePause(db: PauseWriter, applicationId: string, at: Date, reason: string, supplementId?: string): Promise<boolean> {
  const stage = await openStageOf(db, applicationId);
  if (!stage || stage.slaPolicy !== SLA_POLICY_PA1) return false;
  if (await db.applicationStagePause.findFirst({ where: { historyId: stage.id, endedAt: null } })) return false;
  await db.applicationStagePause.create({ data: { historyId: stage.id, startedAt: at, reason, supplementId: supplementId ?? null } });
  await db.applicationStageHistory.update({ where: { id: stage.id }, data: { pausedAt: at } });
  return true;
}

/** Kết thúc khoảng chờ doanh nghiệp đang mở của công đoạn PA1 (nếu có). Gọi lặp an toàn; trả true khi vừa đóng một khoảng. */
export async function closeStagePause(db: PauseWriter, applicationId: string, at: Date): Promise<boolean> {
  const stage = await openStageOf(db, applicationId);
  if (!stage || stage.slaPolicy !== SLA_POLICY_PA1) return false;
  const closed = await db.applicationStagePause.updateMany({ where: { historyId: stage.id, endedAt: null }, data: { endedAt: at } });
  if (closed.count > 0) await db.applicationStageHistory.update({ where: { id: stage.id }, data: { pausedAt: null } });
  return closed.count > 0;
}

export interface StageClosingInput {
  enteredAt: Date;
  pausedAt: Date | null;
  pausedDurationHours: number;
  slaStandardHours: number;
  slaPolicy: string | null;
  slaCalendarVersion: string | null;
}

export interface StageClosingResult {
  actualDurationHours: number;
  pausedDurationHours: number;
  netWorkDurationHours: number;
  isDelayed: boolean;
}

/**
 * Số liệu khi đóng công đoạn tại `exitedAt`.
 * - Cách tính cũ: giữ nguyên công thức hiện có (giờ thực 24/7; trừ tổng giờ đã dừng cộng khoảng dừng đang mở).
 * - PA1: tất cả tính theo giờ làm việc; `actualDurationHours` là giờ làm việc từ lúc vào đến lúc ra (chưa trừ dừng),
 *   `pausedDurationHours` là phần giờ làm việc bị dừng, `netWorkDurationHours` là giờ làm việc ròng so với định mức.
 */
export function computeStageClosing(stage: StageClosingInput, pauses: ReadonlyArray<PauseInterval>, exitedAt: Date): StageClosingResult {
  if (stage.slaPolicy === SLA_POLICY_PA1) {
    const calendar = calendarByVersion(stage.slaCalendarVersion ?? '');
    let actual: number;
    let net: number;
    try {
      actual = workingHoursBetween(stage.enteredAt, exitedAt, calendar);
      net = workingHoursBetween(stage.enteredAt, exitedAt, calendar, pauses);
    } catch (error) {
      if (error instanceof CalendarCoverageError) throw new BadRequestException(error.message);
      throw error;
    }
    return { actualDurationHours: actual, pausedDurationHours: actual - net, netWorkDurationHours: net, isDelayed: net > stage.slaStandardHours };
  }
  const pausedNow = stage.pausedAt ? (exitedAt.getTime() - stage.pausedAt.getTime()) / 3600000 : 0;
  const pausedTotal = stage.pausedDurationHours + pausedNow;
  const actual = (exitedAt.getTime() - stage.enteredAt.getTime()) / 3600000;
  const net = Math.max(0, actual - pausedTotal);
  return { actualDurationHours: actual, pausedDurationHours: pausedTotal, netWorkDurationHours: net, isDelayed: net > stage.slaStandardHours };
}
