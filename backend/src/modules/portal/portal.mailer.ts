import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class PortalMailer {
  private createTransport() {
    const production = process.env.NODE_ENV === 'production';
    if (production && (!process.env.SMTP_HOST || !process.env.SMTP_FROM)) throw new ServiceUnavailableException('Email delivery is not configured.');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || '127.0.0.1',
      port: Number(process.env.SMTP_PORT || (production ? 587 : 1025)),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: production && process.env.SMTP_SECURE !== 'true',
      auth: process.env.SMTP_USER ? {user:process.env.SMTP_USER,pass:process.env.SMTP_PASS} : undefined,
      connectionTimeout:10000, greetingTimeout:10000, socketTimeout:10000,
      logger:false, debug:false, disableFileAccess:true, disableUrlAccess:true,
    });
  }

  async sendCode(email: string, code: string) {
    const transport = this.createTransport();
    try {
      await transport.sendMail({from:process.env.SMTP_FROM || 'noreply@sme-loan.local',to:email,subject:'SME Loan email verification',text:`Your SME Loan verification code is: ${code}\nThis code expires in 10 minutes. If you did not register, ignore this email.`});
    } catch {throw new ServiceUnavailableException('Không gửi được email xác minh. Vui lòng thử gửi lại.');}
    finally {transport.close();}
  }

  /** Nhắc doanh nghiệp bổ sung chứng từ; nội dung chỉ nêu mã hồ sơ, không kèm dữ liệu hồ sơ. */
  async sendSupplementReminder(email: string, applicationCode: string) {
    const transport = this.createTransport();
    try {
      await transport.sendMail({from:process.env.SMTP_FROM || 'noreply@sme-loan.local',to:email,subject:'SME Loan - Nhắc bổ sung chứng từ',text:`Hồ sơ ${applicationCode} đang chờ doanh nghiệp bổ sung chứng từ. Vui lòng đăng nhập cổng doanh nghiệp để bổ sung sớm nhất có thể.`});
    } finally {transport.close();}
  }
}
