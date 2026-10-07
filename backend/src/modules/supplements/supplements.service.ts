import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { CreateSupplementDto } from './dto/create-supplement.dto';
import { ResolveSupplementDto } from './dto/resolve-supplement.dto';
import { LoanStatus, SupplementStatus, StageCode } from '@prisma/client';

@Injectable()
export class SupplementsService {
  private readonly logger = new Logger(SupplementsService.name);

  constructor(
    private prisma: PrismaService,
    private predictionService: PredictionService,
  ) {}

  /**
   * Tạo yêu cầu bổ sung chứng từ (UC06) - Tạm dừng đồng hồ đo SLA
   */
  async createSupplementRequest(applicationId: string, dto: CreateSupplementDto, userId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: applicationId },
    });

    if (!loan) {
      throw new NotFoundException(`Không tìm thấy hồ sơ với ID: ${applicationId}`);
    }

    if (loan.currentStatus === LoanStatus.SUPPLEMENT_REQUIRED) {
      throw new BadRequestException('Hồ sơ hiện đang trong trạng thái chờ bổ sung chứng từ.');
    }

    const now = new Date();

    // 1. Tạo bản ghi yêu cầu bổ sung
    const request = await this.prisma.supplementRequest.create({
      data: {
        applicationId,
        requestContent: dto.requestContent,
        requestedBy: userId,
        requestedAt: now,
        deadlineAt: dto.deadlineAt ? new Date(dto.deadlineAt) : null,
        status: SupplementStatus.PENDING,
        notes: dto.notes,
      },
      include: {
        requester: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    // 2. Tăng số lần bổ sung (supplementCount) và chuyển trạng thái hồ sơ
    await this.prisma.loanApplication.update({
      where: { id: applicationId },
      data: {
        currentStatus: LoanStatus.SUPPLEMENT_REQUIRED,
        supplementCount: { increment: 1 },
        updatedAt: now,
      },
    });

    // 3. TẠM DỪNG SLA: Lưu pausedAt vào bản ghi công đoạn đang diễn ra
    const activeStage = await this.prisma.applicationStageHistory.findFirst({
      where: {
        applicationId,
        exitedAt: null,
      },
      orderBy: { enteredAt: 'desc' },
    });

    if (activeStage && !activeStage.pausedAt) {
      await this.prisma.applicationStageHistory.update({
        where: { id: activeStage.id },
        data: { pausedAt: now },
      });
      this.logger.log(`Tạm dừng đo SLA công đoạn cho hồ sơ ${loan.applicationCode}`);
    }

    return request;
  }

  /**
   * Tiếp nhận và xử lý hoàn tất bổ sung chứng từ (UC07) - Tiếp tục đồng hồ đo SLA & Cập nhật AI
   */
  async resolveSupplementRequest(supplementId: string, dto: ResolveSupplementDto, userId: string) {
    const request = await this.prisma.supplementRequest.findUnique({
      where: { id: supplementId },
      include: { application: true },
    });

    if (!request) {
      throw new NotFoundException(`Không tìm thấy yêu cầu bổ sung ID: ${supplementId}`);
    }

    if (request.status === SupplementStatus.RESOLVED) {
      throw new BadRequestException('Yêu cầu bổ sung này đã được xử lý hoàn tất trước đó.');
    }

    const now = new Date();

    // 1. Cập nhật trạng thái yêu cầu bổ sung
    const updatedRequest = await this.prisma.supplementRequest.update({
      where: { id: supplementId },
      data: {
        status: SupplementStatus.RESOLVED,
        resolvedAt: now,
        notes: dto.notes ? `${request.notes ? request.notes + '\n' : ''}${dto.notes}` : request.notes,
      },
    });

    // 2. TÍNH TOÁN VÀ TIẾP TỤC ĐỒNG HỒ SLA
    const activeStage = await this.prisma.applicationStageHistory.findFirst({
      where: {
        applicationId: request.applicationId,
        exitedAt: null,
      },
      orderBy: { enteredAt: 'desc' },
    });

    if (activeStage && activeStage.pausedAt) {
      const pausedTime = new Date(activeStage.pausedAt).getTime();
      const additionalPausedHours = Math.round(((now.getTime() - pausedTime) / (1000 * 60 * 60)) * 10) / 10;
      const totalPausedHours = Math.round((activeStage.pausedDurationHours + additionalPausedHours) * 10) / 10;

      await this.prisma.applicationStageHistory.update({
        where: { id: activeStage.id },
        data: {
          pausedAt: null, // Đặt lại null để đồng hồ tiếp tục chạy
          pausedDurationHours: totalPausedHours,
        },
      });
      this.logger.log(`Kích hoạt lại đo SLA. Tổng thời gian tạm dừng tích lũy: ${totalPausedHours} giờ`);
    }

    // 3. Khôi phục trạng thái hoạt động của hồ sơ
    let nextStatus: LoanStatus = LoanStatus.PENDING_APPRAISAL;
    if (request.application.currentStage === StageCode.TIEP_NHAN) {
      nextStatus = LoanStatus.CHECKED;
    } else if (request.application.currentStage === StageCode.CAP_TREN) {
      nextStatus = LoanStatus.WAITING_HEAD_OFFICE;
    }

    await this.prisma.loanApplication.update({
      where: { id: request.applicationId },
      data: {
        currentStatus: nextStatus,
        updatedAt: now,
      },
    });

    // 4. KÍCH HOẠT LẠI DỰ BÁO AI (Vì supplement_count đã tăng, nguy cơ trễ hạn sẽ thay đổi)
    try {
      this.logger.log(`Cập nhật dự báo AI sau khi nhận chứng từ bổ sung cho hồ sơ ${request.application.applicationCode}`);
      await this.predictionService.predictForApplication(request.applicationId);
    } catch (err: any) {
      this.logger.warn(`Lỗi khi cập nhật dự báo AI: ${err.message}`);
    }

    return updatedRequest;
  }

  /**
   * Lấy danh sách các yêu cầu bổ sung của một hồ sơ
   */
  async getSupplements(applicationId: string) {
    return this.prisma.supplementRequest.findMany({
      where: { applicationId },
      include: {
        requester: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }
}
