import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SLA_POLICY_PA1, calendarByVersion } from '../workflow/sla/sla-policy';
import { workingHoursBetween } from '../workflow/sla/working-time';
import { nextDailyScanAt } from '../supplements/supplement-reminders.service';
import { PredictionService } from './prediction.service';

const DEFAULT_SCAN_HOURS = [8, 13];   // 08:00 và 13:00 giờ Việt Nam (PREDICTION_SCAN_HOURS="8,13")
const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;

/** "8,13" -> [8, 13]; giá trị sai hoặc để trống thì dùng mặc định. */
export function parseScanHours(raw?: string): number[] {
  const hours = (raw ?? "").split(",").map(item => item.trim()).filter(Boolean).map(Number);
  return hours.length && hours.every(hour => Number.isInteger(hour) && hour >= 0 && hour <= 23) ? [...new Set(hours)].sort((a, b) => a - b) : DEFAULT_SCAN_HOURS;
}

export interface ScanSummary { skipped?: string; scanned: number; predicted: number; unavailable: number; failed: number; aborted: boolean }

/**
 * Chấm lại nguy cơ trễ SLA cho mọi hồ sơ đang mở mỗi ngày làm việc (08:00 và 13:00 giờ Việt Nam), kể cả hồ sơ không có sự kiện mới.
 * Lý do: giờ đã dùng tăng theo thời gian dù không ai thao tác, nên dự báo theo sự kiện đơn thuần sẽ bỏ quên hồ sơ nằm yên.
 * Không đổi trạng thái hồ sơ, không gửi thông báo; chỉ ghi thêm một dòng dự báo. Hồ sơ đang chờ doanh nghiệp bổ sung bị bỏ qua
 * vì đồng hồ SLA đang dừng. Lỗi hoặc ML tắt không ảnh hưởng nghiệp vụ.
 */
@Injectable()
export class PredictionSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PredictionSchedulerService.name);
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private stopped = false;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly prediction: PredictionService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.PREDICTION_SCAN_ENABLED === 'false') return;
    const override = Number(process.env.PREDICTION_SCAN_INTERVAL_MS);   // chỉ dùng để thử nhanh
    if (override > 0) {
      this.timer = setInterval(() => void this.safeScan(0), override);
      this.timer.unref();
    } else {
      this.scheduleDaily(parseScanHours(process.env.PREDICTION_SCAN_HOURS ?? process.env.PREDICTION_SCAN_HOUR));
    }
    // Chấm bù sau khi khởi động, chỉ cho hồ sơ chưa có dự báo trong 6 giờ qua để khởi động lại nhiều lần không sinh dòng trùng.
    this.startupTimer = setTimeout(() => void this.safeScan(6), 60_000);
    this.startupTimer.unref();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) { clearInterval(this.timer); clearTimeout(this.timer); }
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  private scheduleDaily(hours: number[]) {
    const now = new Date();
    const delay = Math.min(...hours.map(hour => nextDailyScanAt(now, hour).getTime())) - Date.now();
    this.timer = setTimeout(() => {
      void this.safeScan(0).finally(() => { if (!this.stopped) this.scheduleDaily(hours); });
    }, delay);
    this.timer.unref();
  }

  private async safeScan(staleHours: number) {
    if (this.running) return;
    this.running = true;
    try {
      const summary = await this.scanOnce(new Date(), staleHours);
      this.logger.log(`Chấm dự báo định kỳ: ${JSON.stringify(summary)}`);
    } catch (err) {
      this.logger.warn(`Chấm dự báo định kỳ lỗi: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Hôm nay (giờ Việt Nam) có giờ làm việc theo lịch của chính sách đang áp dụng không. */
  private async isWorkingDay(now: Date): Promise<{ ok: boolean; reason?: string }> {
    const activation = await this.prisma.slaPolicyActivation.findFirst({ where: { activatedAt: { lte: now } }, orderBy: { activatedAt: 'desc' } });
    if (!activation || activation.policyCode !== SLA_POLICY_PA1) return { ok: false, reason: 'PA1 chưa được kích hoạt' };
    const dayStart = new Date(Math.floor((now.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS);
    try {
      const hours = workingHoursBetween(dayStart, new Date(dayStart.getTime() + DAY_MS), calendarByVersion(activation.calendarVersion));
      return hours > 0 ? { ok: true } : { ok: false, reason: 'không phải ngày làm việc' };
    } catch {
      return { ok: false, reason: 'ngoài kỳ bao phủ của lịch' };
    }
  }

  /** `staleHours` > 0: chỉ chấm hồ sơ chưa có dự báo trong khoảng đó; 0: chấm tất cả hồ sơ đang mở. */
  async scanOnce(now: Date, staleHours = 0): Promise<ScanSummary> {
    const day = await this.isWorkingDay(now);
    if (!day.ok) return { skipped: day.reason, scanned: 0, predicted: 0, unavailable: 0, failed: 0, aborted: false };
    const loans = await this.prisma.loanApplication.findMany({
      where: { currentStage: { in: ['TIEP_NHAN', 'THAM_DINH'] }, currentStatus: { in: ['RECEIVED', 'CHECKED', 'PENDING_APPRAISAL'] } },
      select: { id: true, delayPredictions: { select: { predictionTimestamp: true }, orderBy: { predictionTimestamp: 'desc' }, take: 1 } },
    });
    const cutoff = now.getTime() - staleHours * 3600000;
    const summary: ScanSummary = { scanned: 0, predicted: 0, unavailable: 0, failed: 0, aborted: false };
    let consecutiveFailures = 0;
    for (const loan of loans) {
      const last = loan.delayPredictions[0]?.predictionTimestamp.getTime();
      if (staleHours > 0 && last !== undefined && last >= cutoff) continue;
      summary.scanned++;
      try {
        const result: any = await this.prediction.predictForApplication(loan.id);
        if (result?.unavailable) summary.unavailable++; else summary.predicted++;
        consecutiveFailures = 0;
      } catch (err: any) {
        this.logger.warn(`Quét dự báo lỗi ở hồ sơ ${loan.id}: ${err?.message ?? err}`);
        summary.failed++;
        if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) { summary.aborted = true; break; }   // ML tắt: không chờ hết danh sách
      }
    }
    return summary;
  }
}
