import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, BadRequestException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma.service';
import { PortalMailer } from './portal.mailer';
import { portalSecret } from './portal.validation';

const audience = 'sme-enterprise-portal';
const message = {message:'Vui lòng kiểm tra email để xác minh tài khoản.'};
const publicAccount = (a: any) => ({id:a.id,email:a.email,contactName:a.contactName,phone:a.phone});
const otpHash = (id: string, code: string) => createHmac('sha256',portalSecret()).update(`${id}:${code}`).digest('hex');
function emailValue(value: unknown) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new BadRequestException('Email không hợp lệ.');
  return value.trim().toLowerCase();
}
@Injectable()
export class PortalAuthService {
  private rate = new Map<string,{count:number,until:number}>();
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
    if (typeof body.password!=='string' || body.password.length<8 || Buffer.byteLength(body.password)>72 || !/[A-Za-z]/.test(body.password) || !/\d/.test(body.password)) throw new BadRequestException('Mật khẩu cần 8 ký tự trở lên, có chữ và số, tối đa 72 byte.');
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
      await this.mailer.sendCode(account.email,code);
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
    return {accessToken:await this.jwt.signAsync({sub:a.id,type:'portal'},{secret:portalSecret(),audience,issuer:audience,expiresIn:'8h',algorithm:'HS256'}),account:publicAccount(a)};
  }
  async me(id:string) {
    const a=await this.prisma.portalAccount.findUnique({where:{id}});
    if(!a?.verifiedAt) throw new UnauthorizedException();
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
      req.portalAccount=await this.auth.me(payload.sub);
    } catch {throw new UnauthorizedException('Phiên doanh nghiệp không hợp lệ.');}
    return true;
  }
}
