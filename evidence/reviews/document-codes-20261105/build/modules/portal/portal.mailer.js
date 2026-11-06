"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortalMailer = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = require("nodemailer");
let PortalMailer = class PortalMailer {
    createTransport() {
        const production = process.env.NODE_ENV === 'production';
        if (production && (!process.env.SMTP_HOST || !process.env.SMTP_FROM))
            throw new common_1.ServiceUnavailableException('Email delivery is not configured.');
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || '127.0.0.1',
            port: Number(process.env.SMTP_PORT || (production ? 587 : 1025)),
            secure: process.env.SMTP_SECURE === 'true',
            requireTLS: production && process.env.SMTP_SECURE !== 'true',
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
            connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
            logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
        });
    }
    async sendCode(email, code) {
        const transport = this.createTransport();
        try {
            await transport.sendMail({ from: process.env.SMTP_FROM || 'noreply@sme-loan.local', to: email, subject: 'SME Loan email verification', text: `Your SME Loan verification code is: ${code}\nThis code expires in 10 minutes. If you did not register, ignore this email.` });
        }
        catch {
            throw new common_1.ServiceUnavailableException('Không gửi được email xác minh. Vui lòng thử gửi lại.');
        }
        finally {
            transport.close();
        }
    }
    async sendPasswordReset(email, link) {
        const transport = this.createTransport();
        try {
            await transport.sendMail({ from: process.env.SMTP_FROM || 'noreply@sme-loan.local', to: email, subject: 'SME Loan - Đặt lại mật khẩu', text: `Đặt lại mật khẩu cổng doanh nghiệp tại: ${link}\nLiên kết hết hạn sau 10 phút và chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.` });
        }
        catch {
            throw new common_1.ServiceUnavailableException('Không gửi được email đặt lại mật khẩu.');
        }
        finally {
            transport.close();
        }
    }
    async sendSupplementReminder(email, applicationCode) {
        const transport = this.createTransport();
        try {
            await transport.sendMail({ from: process.env.SMTP_FROM || 'noreply@sme-loan.local', to: email, subject: 'SME Loan - Nhắc bổ sung chứng từ', text: `Hồ sơ ${applicationCode} đang chờ doanh nghiệp bổ sung chứng từ. Vui lòng đăng nhập cổng doanh nghiệp để bổ sung sớm nhất có thể.` });
        }
        finally {
            transport.close();
        }
    }
};
exports.PortalMailer = PortalMailer;
exports.PortalMailer = PortalMailer = __decorate([
    (0, common_1.Injectable)()
], PortalMailer);
//# sourceMappingURL=portal.mailer.js.map