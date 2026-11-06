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
var PortalAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortalGuard = exports.PortalAuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const node_crypto_1 = require("node:crypto");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../../prisma.service");
const portal_mailer_1 = require("./portal.mailer");
const portal_validation_1 = require("./portal.validation");
const audience = 'sme-enterprise-portal';
const message = { message: 'Yêu cầu đã được xử lý. Nếu email chưa xác minh, hãy kiểm tra thư hoặc yêu cầu gửi lại mã; nếu đã xác minh, hãy đăng nhập.' };
const resetMessage = { message: 'Nếu email thuộc tài khoản đã xác minh, bạn sẽ nhận được liên kết đặt lại mật khẩu. Kiểm tra thư rác hoặc thử lại sau 60 giây.' };
const resetHash = (token) => (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
function validatePassword(value) {
    if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value) > 72 || !/[A-Za-z]/.test(value) || !/\d/.test(value))
        throw new common_1.BadRequestException('Mật khẩu cần 8 ký tự trở lên, có chữ và số, tối đa 72 byte.');
}
const publicAccount = (a) => ({ id: a.id, email: a.email, contactName: a.contactName, phone: a.phone });
const otpHash = (id, code) => (0, node_crypto_1.createHmac)('sha256', (0, portal_validation_1.portalSecret)()).update(`${id}:${code}`).digest('hex');
function emailValue(value) {
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        throw new common_1.BadRequestException('Email không hợp lệ.');
    return value.trim().toLowerCase();
}
let PortalAuthService = PortalAuthService_1 = class PortalAuthService {
    prisma;
    jwt;
    mailer;
    rate = new Map();
    resetJobs = new Set();
    logger = new common_1.Logger(PortalAuthService_1.name);
    constructor(prisma, jwt, mailer) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.mailer = mailer;
    }
    throttle(key, max = 15) {
        const now = Date.now();
        if (this.rate.size > 10000)
            for (const [k, v] of this.rate)
                if (v.until < now)
                    this.rate.delete(k);
        const v = this.rate.get(key);
        if (v && v.until > now) {
            if (++v.count > max)
                throw new common_1.HttpException('Thao tác quá nhiều. Vui lòng thử lại sau.', 429);
        }
        else
            this.rate.set(key, { count: 1, until: now + 15 * 60 * 1000 });
    }
    async register(body, ip) {
        this.throttle(`register:${ip}`, 10);
        const email = emailValue(body?.email);
        validatePassword(body.password);
        if (typeof body.contactName !== 'string' || !body.contactName.trim() || body.contactName.length > 200 || typeof body.phone !== 'string' || !/^[+\d ()-]{8,20}$/.test(body.phone))
            throw new common_1.BadRequestException('Tên liên hệ hoặc điện thoại không hợp lệ.');
        const existing = await this.prisma.portalAccount.findUnique({ where: { email } });
        if (existing)
            return message;
        let account;
        try {
            account = await this.prisma.portalAccount.create({ data: { email, passwordHash: await bcrypt.hash(body.password, 12), contactName: body.contactName.trim(), phone: body.phone } });
        }
        catch (e) {
            if (e.code === 'P2002')
                return message;
            throw e;
        }
        await this.issueCode(account.id);
        return message;
    }
    async issueCode(id) {
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM portal_accounts WHERE id=${id} FOR UPDATE`;
            const account = await tx.portalAccount.findUniqueOrThrow({ where: { id } });
            if (account.verifiedAt)
                return;
            if (account.verificationSentAt && Date.now() - account.verificationSentAt.getTime() < 60000)
                throw new common_1.HttpException('Vui lòng chờ 60 giây trước khi gửi lại.', 429);
            const code = String((0, node_crypto_1.randomInt)(100000, 1000000));
            await tx.portalAccount.update({ where: { id }, data: { verificationHash: otpHash(id, code), verificationExpiresAt: new Date(Date.now() + 600000), verificationSentAt: new Date(), verificationAttempts: 0 } });
            try {
                await this.mailer.sendCode(account.email, code);
            }
            catch {
                throw new common_1.ServiceUnavailableException({ code: 'PORTAL_VERIFICATION_DELIVERY_FAILED', message: 'Chưa gửi được mã xác minh. Email đăng ký được giữ lại; vui lòng yêu cầu gửi lại mã.' });
            }
        }, { timeout: 20000 });
    }
    async resend(body, ip) {
        this.throttle(`resend:${ip}`, 10);
        const email = emailValue(body?.email);
        const a = await this.prisma.portalAccount.findUnique({ where: { email } });
        if (a && !a.verifiedAt)
            await this.issueCode(a.id);
        return message;
    }
    async verify(body, ip) {
        this.throttle(`verify:${ip}`, 30);
        const email = emailValue(body?.email);
        if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code))
            throw new common_1.BadRequestException('Mã xác minh không hợp lệ.');
        const success = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM portal_accounts WHERE email=${email} FOR UPDATE`;
            const a = await tx.portalAccount.findUnique({ where: { email } });
            if (!a || a.verifiedAt || !a.verificationHash || !a.verificationExpiresAt || a.verificationExpiresAt.getTime() < Date.now() || a.verificationAttempts >= 5)
                return false;
            const valid = (0, node_crypto_1.timingSafeEqual)(Buffer.from(a.verificationHash, 'hex'), Buffer.from(otpHash(a.id, body.code), 'hex'));
            await tx.portalAccount.update({ where: { id: a.id }, data: valid ? { verifiedAt: new Date(), verificationHash: null, verificationExpiresAt: null } : { verificationAttempts: { increment: 1 } } });
            return valid;
        });
        if (!success)
            throw new common_1.BadRequestException('Mã xác minh sai, hết hạn hoặc đã dùng.');
        return { message: 'Xác minh email thành công. Bạn có thể đăng nhập.' };
    }
    async login(body, ip) {
        this.throttle(`login:${ip}`, 30);
        const email = emailValue(body?.email);
        if (typeof body.password !== 'string' || Buffer.byteLength(body.password) > 72)
            throw new common_1.UnauthorizedException('Thông tin đăng nhập không hợp lệ.');
        const a = await this.prisma.portalAccount.findUnique({ where: { email } });
        if (!a || (a.loginLockedUntil && a.loginLockedUntil.getTime() > Date.now()))
            throw new common_1.UnauthorizedException('Thông tin đăng nhập không hợp lệ hoặc tài khoản tạm khóa.');
        if (!await bcrypt.compare(body.password, a.passwordHash)) {
            const updated = await this.prisma.portalAccount.update({ where: { id: a.id }, data: { loginAttempts: { increment: 1 } } });
            if (updated.loginAttempts >= 5)
                await this.prisma.portalAccount.update({ where: { id: a.id }, data: { loginLockedUntil: new Date(Date.now() + 900000), loginAttempts: 0 } });
            throw new common_1.UnauthorizedException('Thông tin đăng nhập không hợp lệ.');
        }
        if (!a.verifiedAt)
            throw new common_1.UnauthorizedException('Vui lòng xác minh email trước khi đăng nhập.');
        await this.prisma.portalAccount.update({ where: { id: a.id }, data: { loginAttempts: 0, loginLockedUntil: null } });
        return { accessToken: await this.jwt.signAsync({ sub: a.id, type: 'portal', av: a.authVersion ?? 0 }, { secret: (0, portal_validation_1.portalSecret)(), audience, issuer: audience, expiresIn: '8h', algorithm: 'HS256' }), account: publicAccount(a) };
    }
    async forgotPassword(body, ip) {
        const email = emailValue(body?.email);
        this.throttle(`forgot-ip:${ip}`, 10);
        this.throttle(`forgot-email:${email}`, 5);
        if (this.resetJobs.size >= 100)
            throw new common_1.ServiceUnavailableException('Dịch vụ đang bận. Vui lòng thử lại sau.');
        const job = Promise.resolve().then(() => this.issuePasswordReset(email)).catch(() => { this.logger.warn('Password reset delivery did not complete.'); });
        this.resetJobs.add(job);
        void job.finally(() => this.resetJobs.delete(job));
        return resetMessage;
    }
    async onModuleDestroy() { await Promise.allSettled([...this.resetJobs]); }
    async issuePasswordReset(email) {
        const found = await this.prisma.portalAccount.findUnique({ where: { email } });
        if (!found?.verifiedAt)
            return;
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM portal_accounts WHERE id=${found.id} FOR UPDATE`;
            const account = await tx.portalAccount.findUniqueOrThrow({ where: { id: found.id } });
            if (!account.verifiedAt || (account.passwordResetSentAt && Date.now() - account.passwordResetSentAt.getTime() < 60000))
                return;
            const token = (0, node_crypto_1.randomBytes)(32).toString('hex');
            const link = new URL('/portal', process.env.FRONTEND_URL || 'http://localhost:5173');
            link.searchParams.set('reset', token);
            await tx.portalAccount.update({ where: { id: account.id }, data: { passwordResetHash: resetHash(token), passwordResetExpiresAt: new Date(Date.now() + 600000), passwordResetSentAt: new Date() } });
            await this.mailer.sendPasswordReset(account.email, link.toString());
        }, { timeout: 20000 });
    }
    async resetPassword(body, ip) {
        this.throttle(`reset:${ip}`, 30);
        if (typeof body?.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token))
            throw new common_1.BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ, hết hạn hoặc đã dùng.');
        validatePassword(body.password);
        if (body.password !== body.confirmPassword)
            throw new common_1.BadRequestException('Hai mật khẩu chưa khớp nhau.');
        const hash = resetHash(body.token), passwordHash = await bcrypt.hash(body.password, 12);
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM portal_accounts WHERE password_reset_hash=${hash} FOR UPDATE`;
            const a = await tx.portalAccount.findUnique({ where: { passwordResetHash: hash } });
            if (!a?.verifiedAt || !a.passwordResetExpiresAt || a.passwordResetExpiresAt.getTime() <= Date.now())
                throw new common_1.BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ, hết hạn hoặc đã dùng.');
            await tx.portalAccount.update({ where: { id: a.id }, data: { passwordHash, passwordResetHash: null, passwordResetExpiresAt: null, authVersion: { increment: 1 }, loginAttempts: 0, loginLockedUntil: null } });
        });
        return { message: 'Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.' };
    }
    async me(id, authVersion = 0) {
        const a = await this.prisma.portalAccount.findUnique({ where: { id } });
        if (!a?.verifiedAt || !Number.isSafeInteger(authVersion) || authVersion < 0 || (a.authVersion ?? 0) !== authVersion)
            throw new common_1.UnauthorizedException();
        return publicAccount(a);
    }
};
exports.PortalAuthService = PortalAuthService;
exports.PortalAuthService = PortalAuthService = PortalAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, jwt_1.JwtService, portal_mailer_1.PortalMailer])
], PortalAuthService);
let PortalGuard = class PortalGuard {
    jwt;
    auth;
    constructor(jwt, auth) {
        this.jwt = jwt;
        this.auth = auth;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const token = req.headers.authorization?.match(/^Bearer ([^ ]+)$/)?.[1];
        if (!token)
            throw new common_1.UnauthorizedException();
        try {
            const payload = await this.jwt.verifyAsync(token, { secret: (0, portal_validation_1.portalSecret)(), audience, issuer: audience, algorithms: ['HS256'] });
            if (payload.type !== 'portal' || typeof payload.sub !== 'string')
                throw new Error('Principal');
            const version = payload.av === undefined ? 0 : payload.av;
            if (!Number.isSafeInteger(version) || version < 0)
                throw new Error('Session version');
            req.portalAccount = await this.auth.me(payload.sub, version);
        }
        catch {
            throw new common_1.UnauthorizedException('Phiên doanh nghiệp không hợp lệ.');
        }
        return true;
    }
};
exports.PortalGuard = PortalGuard;
exports.PortalGuard = PortalGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService, PortalAuthService])
], PortalGuard);
//# sourceMappingURL=portal.auth.js.map