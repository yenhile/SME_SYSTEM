"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SupplementRemindersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplementRemindersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma.service");
const portal_mailer_1 = require("../portal/portal.mailer");
const supplement_deadlines_1 = require("./supplement-deadlines");
const portal_supplement_1 = require("./portal-supplement");
const DEFAULT_SCAN_INTERVAL_MS = 60 * 60 * 1000;
let SupplementRemindersService = SupplementRemindersService_1 = class SupplementRemindersService {
    prisma;
    mailer;
    logger = new common_1.Logger(SupplementRemindersService_1.name);
    timer;
    running = false;
    constructor(prisma, mailer) {
        this.prisma = prisma;
        this.mailer = mailer;
    }
    onModuleInit() {
        const interval = Number(process.env.SUPPLEMENT_SCAN_INTERVAL_MS ?? DEFAULT_SCAN_INTERVAL_MS);
        if (process.env.NODE_ENV === 'test' || !(interval > 0))
            return;
        this.timer = setInterval(() => void this.safeScan(), interval);
        this.timer.unref();
        setTimeout(() => void this.safeScan(), 30_000).unref();
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async safeScan() {
        if (this.running)
            return;
        this.running = true;
        try {
            const result = await this.scan();
            if (result.reminded || result.overdue)
                this.logger.log(`Quét bổ sung: nhắc ${result.reminded}, quá hạn ${result.overdue}`);
        }
        catch (error) {
            this.logger.error(`Quét yêu cầu bổ sung thất bại: ${error.message}`);
        }
        finally {
            this.running = false;
        }
    }
    async scan(now = new Date()) {
        const rows = await this.prisma.supplementRequest.findMany({
            where: {
                status: client_1.SupplementStatus.PENDING,
                application: { currentStatus: client_1.LoanStatus.SUPPLEMENT_REQUIRED, completedAt: null },
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
                if (row.overdueAt)
                    continue;
                if ((0, portal_supplement_1.waitingOn)(row) === 'BANK')
                    continue;
                if (now >= (0, supplement_deadlines_1.overdueAt)(row.requestedAt, row.deadlineAt)) {
                    if (await this.markOverdue(row, now))
                        result.overdue++;
                    continue;
                }
                const remindAt = (0, supplement_deadlines_1.reminderAt)(row.requestedAt, row.deadlineAt);
                if (remindAt && now >= remindAt && (await this.remind(row, now)))
                    result.reminded++;
            }
            catch (error) {
                this.logger.error(`Xử lý yêu cầu bổ sung ${row.id} thất bại: ${error.message}`);
            }
        }
        return result;
    }
    notify(tx, row, title, message) {
        const officerId = row.application.assignedTo;
        return officerId ? tx.internalNotification.create({ data: { userId: officerId, applicationId: row.applicationId, title, message } }) : undefined;
    }
    async markOverdue(row, now) {
        return this.prisma.$transaction(async (tx) => {
            const claim = await tx.supplementRequest.updateMany({ where: { id: row.id, overdueAt: null }, data: { overdueAt: now } });
            if (claim.count !== 1)
                return false;
            await this.notify(tx, row, 'Hồ sơ quá hạn bổ sung', `Hồ sơ ${row.application.applicationCode} đã quá hạn bổ sung chứng từ. Vui lòng liên hệ doanh nghiệp.`);
            return true;
        });
    }
    async remind(row, now) {
        let claimed = false;
        if (!row.reminderSentAt) {
            claimed = await this.prisma.$transaction(async (tx) => {
                const claim = await tx.supplementRequest.updateMany({ where: { id: row.id, reminderSentAt: null }, data: { reminderSentAt: now } });
                if (claim.count !== 1)
                    return false;
                await this.notify(tx, row, 'Nhắc bổ sung chứng từ', `Hồ sơ ${row.application.applicationCode} đã chờ doanh nghiệp bổ sung chứng từ từ ngày thứ 5.`);
                return true;
            });
            if (!claimed)
                return false;
        }
        const email = row.application.portalRequest?.account?.email;
        if (email && !row.reminderEmailSentAt) {
            try {
                await this.mailer.sendSupplementReminder(email, row.application.applicationCode);
                await this.prisma.supplementRequest.updateMany({ where: { id: row.id, reminderEmailSentAt: null }, data: { reminderEmailSentAt: now } });
            }
            catch (error) {
                this.logger.warn(`Không gửi được email nhắc bổ sung cho hồ sơ ${row.application.applicationCode}: ${error.message}`);
            }
        }
        return claimed;
    }
};
exports.SupplementRemindersService = SupplementRemindersService;
exports.SupplementRemindersService = SupplementRemindersService = SupplementRemindersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, portal_mailer_1.PortalMailer])
], SupplementRemindersService);
//# sourceMappingURL=supplement-reminders.service.js.map