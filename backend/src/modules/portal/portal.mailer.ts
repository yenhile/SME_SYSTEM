import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10000;

type Mail = { to: string; subject: string; text: string; html: string };

const BRAND = '#1d4e89';
const BRAND_HOVER = '#163d6d';
const BRAND_SOFT = '#edf3fa';
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const AUTO_NOTICE = 'Đây là thư tự động từ hệ thống SME Loan. Vui lòng không trả lời thư này.';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] as string);

const paragraph = (html: string, style = '') =>
  `<p class="txt" style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#1f2a3d;${style}">${html}</p>`;

const note = (html: string) =>
  `<p class="muted" style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#5b6678;">${html}</p>`;

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td bgcolor="${BRAND}" style="border-radius:8px;background-color:${BRAND};">` +
  `<a class="btn" href="${escapeHtml(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border:1px solid ${BRAND};border-radius:8px;background-color:${BRAND};">${escapeHtml(label)}</a>` +
  `</td></tr></table>`;

function layout(subject: string, preheader: string, heading: string, body: string) {
  return `<!doctype html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<style>
.btn:hover{background-color:${BRAND_HOVER}!important;border-color:${BRAND_HOVER}!important}
@media (max-width:620px){.card{width:100%!important}.pad{padding:24px 20px!important}.code{font-size:28px!important;letter-spacing:6px!important;padding:14px 14px 14px 20px!important}}
@media (prefers-color-scheme:dark){.bg{background-color:#0f1724!important}.card-body{background-color:#19233a!important;border-color:#2a3850!important}.txt{color:#e6ebf3!important}.heading{color:#a9c8f0!important}.muted{color:#a3aec0!important}.panel{background-color:#1f3350!important;color:#e6ebf3!important;border-color:#6f9ad1!important}.code{background-color:#1f3350!important;color:#ffffff!important;border-color:#6f9ad1!important}.link{color:#a9c8f0!important}}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:#f3f5f9;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;opacity:0;color:#f3f5f9;">${escapeHtml(preheader)}</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f5f9" style="background-color:#f3f5f9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td bgcolor="${BRAND}" style="background-color:${BRAND};padding:20px 32px;border-radius:12px 12px 0 0;font-family:${FONT};">
<div style="font-size:20px;font-weight:700;line-height:1.3;color:#ffffff;">SME Loan</div>
<div style="font-size:13px;line-height:1.5;color:#d6e3f3;">Cổng doanh nghiệp vay vốn</div>
</td></tr>
<tr><td class="card-body pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:32px;border:1px solid #dce3ee;border-top:0;border-radius:0 0 12px 12px;font-family:${FONT};">
<h1 class="heading" style="margin:0 0 20px;font-size:21px;line-height:1.35;font-weight:700;color:${BRAND};">${escapeHtml(heading)}</h1>
${paragraph('Kính gửi Quý doanh nghiệp,')}
${body}
${paragraph('Trân trọng,<br><strong>SME Loan</strong>', 'margin:24px 0 0;')}
</td></tr>
<tr><td class="muted" align="center" style="padding:20px 32px 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:#6b778c;">${escapeHtml(AUTO_NOTICE)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const plainText = (lines: string[]) =>
  ['Kính gửi Quý doanh nghiệp,', '', ...lines, '', 'Trân trọng,', 'SME Loan', '', '---', AUTO_NOTICE].join('\n');

function portalLink() {
  const base = process.env.FRONTEND_URL?.trim();
  return base ? new URL('/portal', base).toString() : undefined;
}

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
        htmlContent: mail.html,
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
      await transport.sendMail({ from: process.env.MAIL_FROM_EMAIL || process.env.SMTP_FROM || 'noreply@sme-loan.local', to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    } finally {
      transport.close();
    }
  }

  async sendCode(email: string, code: string) {
    const subject = 'SME Loan - Mã xác minh đăng ký tài khoản';
    const html = layout(subject, `Mã xác minh của Quý doanh nghiệp: ${code} (hiệu lực 10 phút)`, 'Xác minh địa chỉ email đăng ký',
      paragraph('Cảm ơn Quý doanh nghiệp đã đăng ký tài khoản trên cổng doanh nghiệp SME Loan. Vui lòng nhập mã xác minh dưới đây để hoàn tất đăng ký:') +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:4px 0 16px;">` +
      `<div class="code" style="display:inline-block;padding:16px 18px 16px 28px;background-color:${BRAND_SOFT};border:1px dashed ${BRAND};border-radius:10px;font-family:'Courier New',Consolas,Menlo,monospace;font-size:34px;font-weight:700;line-height:1.2;letter-spacing:10px;color:${BRAND};">${escapeHtml(code)}</div>` +
      `</td></tr></table>` +
      paragraph('Mã có hiệu lực trong <strong>10 phút</strong> kể từ khi thư được gửi.', 'text-align:center;') +
      note('Vì an toàn tài khoản, vui lòng không chia sẻ mã này cho bất kỳ ai, kể cả người tự xưng là nhân viên ngân hàng.') +
      note('Nếu Quý doanh nghiệp không thực hiện đăng ký, vui lòng bỏ qua thư này.'));
    const text = plainText([
      'Cảm ơn Quý doanh nghiệp đã đăng ký tài khoản trên cổng doanh nghiệp SME Loan.',
      `Mã xác minh: ${code}`,
      'Mã có hiệu lực trong 10 phút kể từ khi thư được gửi. Vui lòng không chia sẻ mã này cho bất kỳ ai.',
      'Nếu Quý doanh nghiệp không thực hiện đăng ký, vui lòng bỏ qua thư này.',
    ]);
    await this.deliver({ to: email, subject, text, html }, 'Không gửi được email xác minh. Vui lòng thử gửi lại.');
  }

  async sendPasswordReset(email: string, link: string) {
    const subject = 'SME Loan - Đặt lại mật khẩu';
    const html = layout(subject, 'Liên kết đặt lại mật khẩu cổng doanh nghiệp, hiệu lực 10 phút', 'Yêu cầu đặt lại mật khẩu',
      paragraph('Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản cổng doanh nghiệp SME Loan gắn với địa chỉ email này. Vui lòng nhấn nút bên dưới để đặt mật khẩu mới:') +
      button(link, 'Đặt lại mật khẩu') +
      paragraph('Liên kết có hiệu lực trong <strong>10 phút</strong> và chỉ sử dụng được một lần.') +
      note(`Nếu nút không hoạt động, vui lòng sao chép liên kết sau vào trình duyệt:<br><a class="link" href="${escapeHtml(link)}" target="_blank" rel="noopener" style="color:${BRAND};word-break:break-all;">${escapeHtml(link)}</a>`) +
      note('Nếu Quý doanh nghiệp không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua thư này; mật khẩu hiện tại vẫn được giữ nguyên.'));
    const text = plainText([
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản cổng doanh nghiệp SME Loan gắn với địa chỉ email này.',
      'Vui lòng mở liên kết sau để đặt mật khẩu mới:',
      link,
      'Liên kết có hiệu lực trong 10 phút và chỉ sử dụng được một lần.',
      'Nếu Quý doanh nghiệp không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua thư này; mật khẩu hiện tại vẫn được giữ nguyên.',
    ]);
    await this.deliver({ to: email, subject, text, html }, 'Không gửi được email đặt lại mật khẩu.');
  }

  /** Nhắc doanh nghiệp bổ sung chứng từ; nội dung chỉ nêu mã hồ sơ, không kèm dữ liệu hồ sơ. */
  async sendSupplementReminder(email: string, applicationCode: string) {
    const subject = 'SME Loan - Nhắc bổ sung chứng từ';
    const portal = portalLink();
    const html = layout(subject, `Hồ sơ ${applicationCode} đang chờ Quý doanh nghiệp bổ sung chứng từ`, 'Hồ sơ đang chờ bổ sung chứng từ',
      paragraph('Hồ sơ vay vốn dưới đây hiện đang chờ Quý doanh nghiệp bổ sung chứng từ theo yêu cầu:') +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>` +
      `<td class="panel" style="padding:14px 18px;background-color:${BRAND_SOFT};border-left:4px solid ${BRAND};border-radius:6px;font-size:15px;line-height:1.5;color:#1f2a3d;">Mã hồ sơ: <strong style="font-size:17px;">${escapeHtml(applicationCode)}</strong></td>` +
      `</tr></table>` +
      paragraph('Vui lòng đăng nhập cổng doanh nghiệp để xem chi tiết yêu cầu và tải lên chứng từ sớm nhất có thể, giúp hồ sơ được tiếp tục xử lý.') +
      (portal ? button(portal, 'Đăng nhập cổng doanh nghiệp') : '') +
      note('Nếu Quý doanh nghiệp đã bổ sung đầy đủ chứng từ, vui lòng bỏ qua thư này.'));
    const text = plainText([
      `Hồ sơ vay vốn ${applicationCode} hiện đang chờ Quý doanh nghiệp bổ sung chứng từ theo yêu cầu.`,
      'Vui lòng đăng nhập cổng doanh nghiệp để xem chi tiết yêu cầu và tải lên chứng từ sớm nhất có thể, giúp hồ sơ được tiếp tục xử lý.',
      ...(portal ? [`Đăng nhập tại: ${portal}`] : []),
      'Nếu Quý doanh nghiệp đã bổ sung đầy đủ chứng từ, vui lòng bỏ qua thư này.',
    ]);
    await this.deliver({ to: email, subject, text, html }, 'Không gửi được email nhắc bổ sung chứng từ.');
  }
}
