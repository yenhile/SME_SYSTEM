import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoanStatus, SupplementStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { PortalMailer } from '../portal/portal.mailer';
import { overdueAt, reminderAt } from './supplement-deadlines';
import { waitingOn } from './portal-supplement';

const DEFAULT_SCAN_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Quét yêu cầu bổ sung chờ doanh nghiệp (DEC-02): nhắc ở ngày 5, đánh dấu quá hạn ở ngày 10.
 * Chỉ nhắc và đánh dấu; tuyệt đối không đổi trạng thái hồ sơ hay đóng hồ sơ.
 */
@Injectable()
export class SupplementRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupplementRemindersService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly mailer: PortalMailer) {}

  onModuleInit() {
    const interval = Number(process.env.SUPPLEMENT_SCAN_INTERVAL_MS ?? DEFAULT_SCAN_INTERVAL_MS);
    if (process.env.NODE_ENV === 'test' || !(interval > 0)) return;
    this.timer = setInterval(() => void this.safeScan(), interval);
    this.timer.unref();
    setTimeout(() => void this.safeScan(), 30_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeScan() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.scan();
      if (result.reminded || result.overdue) this.logger.log(`Quét bổ sung: nhắc ${result.reminded}, quá hạn ${result.overdue}`);
    } catch (error) {
      this.logger.error(`Quét yêu cầu bổ sung thất bại: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async scan(now: Date = new Date()) {
    const rows: any[] = await this.prisma.supplementRequest.findMany({
      where: {
        status: SupplementStatus.PENDING,
        application: { currentStatus: LoanStatus.SUPPLEMENT_REQUIRED, completedAt: null },
      },
      select: {
        id: true, applicationId: true, requestedAt: true, deadlineAt: true, portalSupplement: true,
        reminderSentAt: true, reminderEmailSentAt: true, overdueAt: true,
        application: {
          select: {
            id: true, applicationCode: true, assignedTo: true,
            portalRequest: { select: { account: { select: { email: true } } } },
          },
        },
      },
    });
    const result = { reminded: 0, overdue: 0 };
    for (const row of rows) {
      try {
        if (row.overdueAt) continue;
        // Doanh nghiệp đã gửi đủ và đang chờ ngân hàng kiểm tra: không nhắc thiếu, không đánh dấu quá hạn. Hạn gốc không bị reset.
        if (waitingOn(row) === 'BANK') continue;
        if (now >= overdueAt(row.requestedAt, row.deadlineAt)) {
          if (await this.markOverdue(row, now)) result.overdue++;
          continue;
        }
        const remindAt = reminderAt(row.requestedAt, row.deadlineAt);
        if (remindAt && now >= remindAt && (await this.remind(row, now))) result.reminded++;
      } catch (error) {
        this.logger.error(`Xử lý yêu cầu bổ sung ${row.id} thất bại: ${(error as Error).message}`);
      }
    }
    return result;
  }

  private notify(tx: any, row: any, title: string, message: string) {
    const officerId = row.application.assignedTo;
    return officerId ? tx.internalNotification.create({ data: { userId: officerId, applicationId: row.applicationId, title, message } }) : undefined;
  }

  private async markOverdue(row: any, now: Date) {
    return this.prisma.$transaction(async (tx: any) => {
      const claim = await tx.supplementRequest.updateMany({ where: { id: row.id, overdueAt: null }, data: { overdueAt: now } });
      if (claim.count !== 1) return false;
      await this.notify(tx, row, 'Hồ sơ quá hạn bổ sung', `Hồ sơ ${row.application.applicationCode} đã quá hạn bổ sung chứng từ. Vui lòng liên hệ doanh nghiệp.`);
      return true;
    });
  }

  /** Trả true khi lần quét này vừa tạo thông báo nhắc mới (email lỗi được thử lại ở lần quét sau, không nhắc CBTD lại). */
  private async remind(row: any, now: Date) {
    let claimed = false;
    if (!row.reminderSentAt) {
      claimed = await this.prisma.$transaction(async (tx: any) => {
        const claim = await tx.supplementRequest.updateMany({ where: { id: row.id, reminderSentAt: null }, data: { reminderSentAt: now } });
        if (claim.count !== 1) return false;
        await this.notify(tx, row, 'Nhắc bổ sung chứng từ', `Hồ sơ ${row.application.applicationCode} đã chờ doanh nghiệp bổ sung chứng từ từ ngày thứ 5.`);
        return true;
      });
      if (!claimed) return false;
    }
    const email = row.application.portalRequest?.account?.email;
    if (email && !row.reminderEmailSentAt) {
      try {
        await this.mailer.sendSupplementReminder(email, row.application.applicationCode);
        await this.prisma.supplementRequest.updateMany({ where: { id: row.id, reminderEmailSentAt: null }, data: { reminderEmailSentAt: now } });
      } catch (error) {
        this.logger.warn(`Không gửi được email nhắc bổ sung cho hồ sơ ${row.application.applicationCode}: ${(error as Error).message}`);
      }
    }
    return claimed;
  }
}
