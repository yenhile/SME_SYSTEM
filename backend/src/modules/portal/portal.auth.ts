import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, BadRequestException, HttpException, ServiceUnavailableException, Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma.service';
import { PortalMailer } from './portal.mailer';
import { portalSecret } from './portal.validation';

const audience = 'sme-enterprise-portal';
const message = {message:'Yêu cầu đã được xử lý. Nếu email chưa xác minh, hãy kiểm tra thư hoặc yêu cầu gửi lại mã; nếu đã xác minh, hãy đăng nhập.'};
const resetMessage = {message:'Nếu email thuộc tài khoản đã xác minh, bạn sẽ nhận được liên kết đặt lại mật khẩu. Kiểm tra thư rác hoặc thử lại sau 60 giây.'};
const resetHash = (token:string) => createHash('sha256').update(token).digest('hex');
function validatePassword(value:unknown) {
  if (typeof value!=='string' || value.length<8 || Buffer.byteLength(value)>72 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) throw new BadRequestException('Mật khẩu cần 8 ký tự trở lên, có chữ và số, tối đa 72 byte.');
}
const publicAccount = (a: any) => ({id:a.id,email:a.email,contactName:a.contactName,phone:a.phone});
const otpHash = (id: string, code: string) => createHmac('sha256',portalSecret()).update(`${id}:${code}`).digest('hex');
function emailValue(value: unknown) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new BadRequestException('Email không hợp lệ.');
  return value.trim().toLowerCase();
}
@Injectable()
export class PortalAuthService implements OnModuleDestroy {
  private rate = new Map<string,{count:number,until:number}>();
  private resetJobs = new Set<Promise<void>>();
  private readonly logger = new Logger(PortalAuthService.name);
  constructor(private prisma:PrismaService, private jwt:JwtService, private mailer:PortalMailer) {}
  throttle(key:string, max=15) {
    const now=Date.now();
    if (this.rate.size>10000) for (const [k,v] of this.rate) if (v.until<now) this.rate.delete(k);
    const v=this.rate.get(key);
    if (v && v.until>now) {if (++v.count>max) throw new HttpException('Thao tác quá nhiều. Vui lòng thử lại sau.',429);}
    else this.rate.set(key,{count:1,until:now+15*60*1000});
  }
  async register(body:any, ip:string) {
    this.throttle(`register:${ip}`,10);
    const email=emailValue(body?.email);
    validatePassword(body.password);
    if (typeof body.contactName!=='string' || !body.contactName.trim() || body.contactName.length>200 || typeof body.phone!=='string' || !/^[+\d ()-]{8,20}$/.test(body.phone)) throw new BadRequestException('Tên liên hệ hoặc điện thoại không hợp lệ.');
    const existing=await this.prisma.portalAccount.findUnique({where:{email}});
    if (existing) return message;
    let account;
    try {account=await this.prisma.portalAccount.create({data:{email,passwordHash:await bcrypt.hash(body.password,12),contactName:body.contactName.trim(),phone:body.phone}});}
    catch(e:any) {if(e.code==='P2002') return message; throw e;}
    await this.issueCode(account.id);
    return message;
  }
  async issueCode(id:string) {
    // Lock the account across SMTP delivery: concurrent resends cannot invalidate each other's code.
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM portal_accounts WHERE id=${id} FOR UPDATE`;
      const account=await tx.portalAccount.findUniqueOrThrow({where:{id}});
      if(account.verifiedAt) return;
      if(account.verificationSentAt && Date.now()-account.verificationSentAt.getTime()<60000) throw new HttpException('Vui lòng chờ 60 giây trước khi gửi lại.',429);
      const code=String(randomInt(100000,1000000));
      await tx.portalAccount.update({where:{id},data:{verificationHash:otpHash(id,code),verificationExpiresAt:new Date(Date.now()+600000),verificationSentAt:new Date(),verificationAttempts:0}});
      try { await this.mailer.sendCode(account.email,code); }
      catch { throw new ServiceUnavailableException({code:'PORTAL_VERIFICATION_DELIVERY_FAILED',message:'Chưa gửi được mã xác minh. Email đăng ký được giữ lại; vui lòng yêu cầu gửi lại mã.'}); }
    },{timeout:20000});
  }
  async resend(body:any,ip:string) {
    this.throttle(`resend:${ip}`,10);
    const email=emailValue(body?.email);
    const a=await this.prisma.portalAccount.findUnique({where:{email}});
    if(a && !a.verifiedAt) await this.issueCode(a.id);
    return message;
  }
  async verify(body:any,ip:string) {
    this.throttle(`verify:${ip}`,30);
    const email=emailValue(body?.email);
    if(typeof body.code!=='string' || !/^\d{6}$/.test(body.code)) throw new BadRequestException('Mã xác minh không hợp lệ.');
    const success=await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM portal_accounts WHERE email=${email} FOR UPDATE`;
      const a=await tx.portalAccount.findUnique({where:{email}});
      if(!a || a.verifiedAt || !a.verificationHash || !a.verificationExpiresAt || a.verificationExpiresAt.getTime()<Date.now() || a.verificationAttempts>=5) return false;
      const valid=timingSafeEqual(Buffer.from(a.verificationHash,'hex'),Buffer.from(otpHash(a.id,body.code),'hex'));
      await tx.portalAccount.update({where:{id:a.id},data:valid ? {verifiedAt:new Date(),verificationHash:null,verificationExpiresAt:null} : {verificationAttempts:{increment:1}}});
      return valid;
    });
    if(!success) throw new BadRequestException('Mã xác minh sai, hết hạn hoặc đã dùng.');
    return {message:'Xác minh email thành công. Bạn có thể đăng nhập.'};
  }
  async login(body:any,ip:string) {
    this.throttle(`login:${ip}`,30);
    const email=emailValue(body?.email);
    if(typeof body.password!=='string' || Buffer.byteLength(body.password)>72) throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ.');
    const a=await this.prisma.portalAccount.findUnique({where:{email}});
    if(!a || (a.loginLockedUntil && a.loginLockedUntil.getTime()>Date.now())) throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ hoặc tài khoản tạm khóa.');
    if(!await bcrypt.compare(body.password,a.passwordHash)) {
      const updated=await this.prisma.portalAccount.update({where:{id:a.id},data:{loginAttempts:{increment:1}}});
      if(updated.loginAttempts>=5) await this.prisma.portalAccount.update({where:{id:a.id},data:{loginLockedUntil:new Date(Date.now()+900000),loginAttempts:0}});
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ.');
    }
    if(!a.verifiedAt) throw new UnauthorizedException('Vui lòng xác minh email trước khi đăng nhập.');
    await this.prisma.portalAccount.update({where:{id:a.id},data:{loginAttempts:0,loginLockedUntil:null}});
    return {accessToken:await this.jwt.signAsync({sub:a.id,type:'portal',av:a.authVersion??0},{secret:portalSecret(),audience,issuer:audience,expiresIn:'8h',algorithm:'HS256'}),account:publicAccount(a)};
  }
  async forgotPassword(body:any,ip:string) {
    const email=emailValue(body?.email);
    this.throttle(`forgot-ip:${ip}`,10);this.throttle(`forgot-email:${email}`,5);
    // All valid emails receive the same response without waiting for account lookup or SMTP.
    // The bounded job set also drains on graceful shutdown. Failed delivery leaves no live token.
    if(this.resetJobs.size>=100) throw new ServiceUnavailableException('Dịch vụ đang bận. Vui lòng thử lại sau.');
    const job=Promise.resolve().then(()=>this.issuePasswordReset(email)).catch(()=>{this.logger.warn('Password reset delivery did not complete.');});
    this.resetJobs.add(job);void job.finally(()=>this.resetJobs.delete(job));
    return resetMessage;
  }
  async onModuleDestroy() { await Promise.allSettled([...this.resetJobs]); }
  private async issuePasswordReset(email:string) {
    const found=await this.prisma.portalAccount.findUnique({where:{email}});
    if(!found?.verifiedAt) return;
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM portal_accounts WHERE id=${found.id} FOR UPDATE`;
      const account=await tx.portalAccount.findUniqueOrThrow({where:{id:found.id}});
      if(!account.verifiedAt || (account.passwordResetSentAt && Date.now()-account.passwordResetSentAt.getTime()<60000)) return;
      const token=randomBytes(32).toString('hex');
      const link=new URL('/portal',process.env.FRONTEND_URL||'http://localhost:5173');link.searchParams.set('reset',token);
      await tx.portalAccount.update({where:{id:account.id},data:{passwordResetHash:resetHash(token),passwordResetExpiresAt:new Date(Date.now()+600000),passwordResetSentAt:new Date()}});
      await this.mailer.sendPasswordReset(account.email,link.toString());
    },{timeout:20000});
  }
  async resetPassword(body:any,ip:string) {
    this.throttle(`reset:${ip}`,30);
    if(typeof body?.token!=='string'||! /^[a-f0-9]{64}$/.test(body.token)) throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ, hết hạn hoặc đã dùng.');
    validatePassword(body.password);
    if(body.password!==body.confirmPassword) throw new BadRequestException('Hai mật khẩu chưa khớp nhau.');
    const hash=resetHash(body.token),passwordHash=await bcrypt.hash(body.password,12);
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM portal_accounts WHERE password_reset_hash=${hash} FOR UPDATE`;
      const a=await tx.portalAccount.findUnique({where:{passwordResetHash:hash}});
      if(!a?.verifiedAt || !a.passwordResetExpiresAt || a.passwordResetExpiresAt.getTime()<=Date.now()) throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ, hết hạn hoặc đã dùng.');
      await tx.portalAccount.update({where:{id:a.id},data:{passwordHash,passwordResetHash:null,passwordResetExpiresAt:null,authVersion:{increment:1},loginAttempts:0,loginLockedUntil:null}});
    });
    return {message:'Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.'};
  }
  async me(id:string,authVersion=0) {
    const a=await this.prisma.portalAccount.findUnique({where:{id}});
    if(!a?.verifiedAt || !Number.isSafeInteger(authVersion) || authVersion<0 || (a.authVersion??0)!==authVersion) throw new UnauthorizedException();
    return publicAccount(a);
  }
}
@Injectable()
export class PortalGuard implements CanActivate {
  constructor(private jwt:JwtService,private auth:PortalAuthService) {}
  async canActivate(context:ExecutionContext) {
    const req=context.switchToHttp().getRequest();
    const token=req.headers.authorization?.match(/^Bearer ([^ ]+)$/)?.[1];
    if(!token) throw new UnauthorizedException();
    try {
      const payload=await this.jwt.verifyAsync(token,{secret:portalSecret(),audience,issuer:audience,algorithms:['HS256']});
      if(payload.type!=='portal' || typeof payload.sub!=='string') throw new Error('Principal');
      const version=payload.av===undefined?0:payload.av;
      if(!Number.isSafeInteger(version)||version<0) throw new Error('Session version');
      req.portalAccount=await this.auth.me(payload.sub,version);
    } catch {throw new UnauthorizedException('Phiên doanh nghiệp không hợp lệ.');}
    return true;
  }
}
