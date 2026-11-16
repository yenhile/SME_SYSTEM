import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10000;

type Mail = { to: string; subject: string; text: string };

/**
 * Production sends through the Brevo transactional email API.
 * Outside production, MAIL_PROVIDER=local (the default without a Brevo key) delivers to the loopback test mailbox.
 */
@Injectable()
export class PortalMailer {
  private readonly logger = new Logger(PortalMailer.name);

  private provider(): 'brevo' | 'local' {
    const production = process.env.NODE_ENV === 'production';
    const configured = process.env.MAIL_PROVIDER?.trim().toLowerCase();
    const provider = configured === 'brevo' || configured === 'local' ? configured : process.env.BREVO_API_KEY ? 'brevo' : 'local';
    if (production && provider !== 'brevo') throw new ServiceUnavailableException('Email delivery is not configured.');
    if (provider === 'brevo' && (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM_EMAIL)) throw new ServiceUnavailableException('Email delivery is not configured.');
    return provider;
  }

  private async deliver(mail: Mail, failure: string) {
    const provider = this.provider();
    try {
      if (provider === 'brevo') await this.sendBrevo(mail);
      else await this.sendLocal(mail);
    } catch (error) {
      this.logger.warn(`Email delivery via ${provider} failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(failure);
    }
  }

  private async sendBrevo(mail: Mail) {
    const response = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY as string, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.MAIL_FROM_EMAIL, name: process.env.MAIL_FROM_NAME || 'SME Loan' },
        to: [{ email: mail.to }],
        subject: mail.subject,
        textContent: mail.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({})) as { code?: string };
      throw new Error(`Brevo responded ${response.status}${detail.code ? ` (${detail.code})` : ''}`);
    }
  }

  private async sendLocal(mail: Mail) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || '127.0.0.1',
      port: Number(process.env.SMTP_PORT || 1025),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS,
      logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
    });
    try {
      await transport.sendMail({ from: process.env.MAIL_FROM_EMAIL || process.env.SMTP_FROM || 'noreply@sme-loan.local', to: mail.to, subject: mail.subject, text: mail.text });
    } finally {
      transport.close();
    }
  }

  async sendCode(email: string, code: string) {
    await this.deliver(
      { to: email, subject: 'SME Loan email verification', text: `Your SME Loan verification code is: ${code}\nThis code expires in 10 minutes. If you did not register, ignore this email.` },
      'Không gửi được email xác minh. Vui lòng thử gửi lại.',
    );
  }

  async sendPasswordReset(email: string, link: string) {
    await this.deliver(
      { to: email, subject: 'SME Loan - Đặt lại mật khẩu', text: `Đặt lại mật khẩu cổng doanh nghiệp tại: ${link}\nLiên kết hết hạn sau 10 phút và chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.` },
      'Không gửi được email đặt lại mật khẩu.',
    );
  }

  /** Nhắc doanh nghiệp bổ sung chứng từ; nội dung chỉ nêu mã hồ sơ, không kèm dữ liệu hồ sơ. */
  async sendSupplementReminder(email: string, applicationCode: string) {
    await this.deliver(
      { to: email, subject: 'SME Loan - Nhắc bổ sung chứng từ', text: `Hồ sơ ${applicationCode} đang chờ doanh nghiệp bổ sung chứng từ. Vui lòng đăng nhập cổng doanh nghiệp để bổ sung sớm nhất có thể.` },
      'Không gửi được email nhắc bổ sung chứng từ.',
    );
  }
}
