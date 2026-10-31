import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginThrottle } from './login-throttle';

@Injectable()
export class AuthService {
  private readonly loginThrottle = new LoginThrottle();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto, now: number = Date.now()) {
    const { username, password } = loginDto;
    // Giới hạn thử mật khẩu theo tên đăng nhập; đang bị khóa thì từ chối cả khi mật khẩu đúng, tới hết thời gian chờ.
    const throttleKey = username.trim().toLowerCase();
    const waitMs = this.loginThrottle.retryAfterMs(throttleKey, now);
    if (waitMs > 0) {
      throw new HttpException(`Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(waitMs / 60000)} phút.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      this.loginThrottle.recordFailure(throttleKey, now);
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị tạm khóa, vui lòng liên hệ Quản trị viên.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      this.loginThrottle.recordFailure(throttleKey, now);
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
    this.loginThrottle.reset(throttleKey);

    const userRoles = user.roles.map((r) => r.role.code);

    const payload = {
      sub: user.id,
      username: user.username,
      roles: userRoles,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Đăng nhập thành công',
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        branchName: user.branchName,
        roles: userRoles,
      },
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy thông tin người dùng.');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: 'Đổi mật khẩu thành công.' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại.');
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      branchName: user.branchName,
      roles: user.roles.map((r) => r.role.code),
    };
  }
}
