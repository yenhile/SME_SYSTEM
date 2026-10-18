import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/** All financial object routes check assignment in addition to the active role. */
@Injectable()
export class LoanAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const params = request.params;
    let applicationId = params.applicationId;
    if (params.supplementId) {
      const record = await this.prisma.supplementRequest.findUnique({ where: { id: params.supplementId } });
      if (!record) throw new NotFoundException('Không tìm thấy yêu cầu bổ sung.');
      applicationId = record.applicationId;
    } else if (params.id && request.originalUrl.startsWith('/api/documents/')) {
      const record = await this.prisma.document.findUnique({ where: { id: params.id } });
      if (!record) throw new NotFoundException('Không tìm thấy chứng từ.');
      applicationId = record.applicationId;
    } else if (params.id) {
      applicationId = params.id;
    }
    if (!applicationId) return true;
    const loan = await this.prisma.loanApplication.findUnique({ where: { id: applicationId } });
    if (!loan) throw new NotFoundException('Không tìm thấy hồ sơ vay.');
    if (request.user.activeRole === 'CBTD' && loan.assignedTo !== request.user.id) {
      throw new ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
    }
    request.loan = loan;
    if (request.method !== 'GET') {
      if (loan.completedAt || loan.currentStage === 'HOAN_TAT') throw new ForbiddenException('Hồ sơ đã kết thúc, không thể chỉnh sửa.');
      if (request.originalUrl.startsWith('/api/documents/') || request.originalUrl.startsWith('/api/supplements/')) {
        const expectedRole = loan.currentStage === 'TIEP_NHAN' ? 'CBTD' : 'THAM_QUYEN';
        if (request.user.activeRole !== expectedRole) throw new ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
      }
    }
    return true;
  }
}
