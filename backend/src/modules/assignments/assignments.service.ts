import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { ReassignOfficerDto } from './dto/reassign-officer.dto';
import { RoleCode, LoanStatus } from '@prisma/client';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    private prisma: PrismaService,
    private predictionService: PredictionService,
  ) {}

  /**
   * Lấy tải công việc hiện tại của toàn bộ Cán bộ tín dụng (CBTD)
   * Giúp Quản lý chi nhánh lựa chọn người có tải công việc thấp nhất
   */
  async getOfficerWorkloads() {
    const officers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              code: RoleCode.CBTD,
            },
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        branchName: true,
        roles: {
          include: { role: true },
        },
      },
    });

    const activeStatuses: LoanStatus[] = [
      LoanStatus.RECEIVED,
      LoanStatus.CHECKED,
      LoanStatus.SUPPLEMENT_REQUIRED,
      LoanStatus.PENDING_APPRAISAL,
      LoanStatus.WAITING_HEAD_OFFICE,
    ];

    const results = await Promise.all(
      officers.map(async (officer) => {
        const activeCount = await this.prisma.loanApplication.count({
          where: {
            assignedTo: officer.id,
            currentStatus: { in: activeStatuses },
          },
        });

        const highRiskCount = await this.prisma.loanApplication.count({
          where: {
            assignedTo: officer.id,
            currentStatus: { in: activeStatuses },
            delayPredictions: {
              some: { riskLevel: 'CAO' },
            },
          },
        });

        return {
          id: officer.id,
          fullName: officer.fullName,
          username: officer.username,
          phone: officer.phone,
          branchName: officer.branchName,
          roles: officer.roles.map((r) => r.role.code),
          activeLoanCount: activeCount,
          highRiskLoanCount: highRiskCount,
          workloadStatus: activeCount >= 10 ? 'QUÁ TẢI' : activeCount >= 6 ? 'BẬN RỘN' : 'KHẢ DỤNG',
        };
      }),
    );

    // Sắp xếp ưu tiên người có ít hồ sơ nhất lên đầu
    return results.sort((a, b) => a.activeLoanCount - b.activeLoanCount);
  }

  /**
   * Xem lịch sử điều chuyển của một hồ sơ (UC19)
   */
  async getAssignmentHistory(applicationId: string) {
    return this.prisma.applicationAssignment.findMany({
      where: { applicationId },
      include: {
        fromUser: { select: { id: true, fullName: true, username: true } },
        toUser: { select: { id: true, fullName: true, username: true } },
        manager: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { reassignedAt: 'desc' },
    });
  }

  /**
   * Thực hiện điều chuyển cán bộ xử lý hồ sơ (UC19)
   */
  async reassign(applicationId: string, dto: ReassignOfficerDto, managerId: string) {
    // Toàn bộ kiểm tra, ghi lịch sử và đổi người phụ trách chạy trong một giao dịch có khóa hồ sơ:
    // lỗi giữa chừng hoặc hai lần điều chuyển đồng thời không làm lịch sử lệch với người phụ trách.
    const { loan, targetOfficer, assignmentRecord, updatedLoan } = await this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${applicationId} FOR UPDATE`;
    const loan = await tx.loanApplication.findUnique({
      where: { id: applicationId },
    });

    if (!loan) {
      throw new NotFoundException(`Không tìm thấy hồ sơ với ID: ${applicationId}`);
    }

    if (loan.completedAt || loan.currentStage === 'HOAN_TAT') throw new BadRequestException('Hồ sơ đã kết thúc, không thể điều chuyển.');
    if (dto.newOfficerId === managerId) throw new BadRequestException('Quản lý không được tự giao hồ sơ cho chính mình.');
    if (loan.assignedTo === dto.newOfficerId) {
      throw new BadRequestException('Cán bộ mới được chọn trùng với cán bộ đang xử lý hiện tại.');
    }

    // Kiểm tra cán bộ mới tồn tại và hoạt động
    const targetOfficer = await tx.user.findUnique({
      where: { id: dto.newOfficerId },
      include: { roles: { include: { role: true } } },
    });

    if (!targetOfficer || !targetOfficer.isActive) {
      throw new NotFoundException('Cán bộ nhận bàn giao không tồn tại hoặc đã bị khóa tài khoản.');
    }

    if (!targetOfficer.roles.some(item => item.role.code === 'CBTD')) throw new BadRequestException('Cán bộ nhận bàn giao phải có vai trò CBTD.');
    const now = new Date();

    // 1. Lưu bản ghi lịch sử điều chuyển
    const assignmentRecord = await tx.applicationAssignment.create({
      data: {
        applicationId,
        fromUserId: loan.assignedTo,
        toUserId: dto.newOfficerId,
        reassignedBy: managerId,
        reassignedAt: now,
        reason: dto.reason || 'Điều phối phân bổ tải công việc chi nhánh',
      },
      include: {
        fromUser: { select: { id: true, fullName: true, username: true } },
        toUser: { select: { id: true, fullName: true, username: true } },
        manager: { select: { id: true, fullName: true, username: true } },
      },
    });

    // 2. Cập nhật cán bộ phụ trách mới cho hồ sơ
    const updatedLoan = await tx.loanApplication.update({
      where: { id: applicationId },
      data: {
        assignedTo: dto.newOfficerId,
        updatedAt: now,
      },
      include: {
        company: true,
        assignedUser: { select: { id: true, fullName: true, username: true } },
      },
    });
    return { loan, targetOfficer, assignmentRecord, updatedLoan };
    });

    // 3. KÍCH HOẠT LẠI DỰ BÁO AI
    // (Vì officer_workload của cán bộ mới sẽ tác động làm giảm hoặc tăng xác suất trễ hạn)
    try {
      this.logger.log(`Tái đánh giá nguy cơ AI sau khi điều chuyển hồ sơ ${loan.applicationCode} sang cán bộ ${targetOfficer.fullName}`);
      await this.predictionService.predictForApplication(applicationId);
    } catch (err: any) {
      this.logger.warn(`Lỗi khi cập nhật dự báo AI sau điều chuyển: ${err.message}`);
    }

    return {
      assignment: assignmentRecord,
      loan: updatedLoan,
    };
  }
}
