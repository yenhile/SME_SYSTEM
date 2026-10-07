import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { StageCode, LoanStatus } from '@prisma/client';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private prisma: PrismaService,
    private predictionService: PredictionService,
  ) {}

  /**
   * Lấy danh mục 4 công đoạn chuẩn và SLA định mức
   */
  async getWorkflowStages() {
    return this.prisma.workflowStage.findMany({
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Xem toàn bộ lịch sử công đoạn của một hồ sơ
   */
  async getWorkflowHistory(applicationId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, applicationCode: true },
    });

    if (!loan) {
      throw new NotFoundException(`Không tìm thấy hồ sơ với ID: ${applicationId}`);
    }

    return this.prisma.applicationStageHistory.findMany({
      where: { applicationId },
      include: {
        stage: true,
        handler: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { enteredAt: 'asc' },
    });
  }

  /**
   * Thực hiện chuyển đổi công đoạn quy trình (State Machine Transition)
   */
  async transitionStage(applicationId: string, dto: TransitionStageDto, userId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: applicationId },
      include: {
        company: true,
      },
    });

    if (!loan) {
      throw new NotFoundException(`Không tìm thấy hồ sơ với ID: ${applicationId}`);
    }

    // 1. Kiểm tra logic quy trình nghiệp vụ (Business Rules)
    this.validateTransition(loan.currentStage, dto.targetStage, dto.targetStatus, loan.officialAmount ? Number(loan.officialAmount) : Number(loan.proposedAmount));

    // 2. Tìm WorkflowStage đích trong DB
    const targetStageRecord = await this.prisma.workflowStage.findUnique({
      where: { stageCode: dto.targetStage },
    });

    if (!targetStageRecord) {
      throw new NotFoundException(`Không tìm thấy cấu hình công đoạn: ${dto.targetStage}`);
    }

    const now = new Date();

    // 3. Đóng công đoạn hiện tại nếu đang mở (exitedAt is null)
    const openHistory = await this.prisma.applicationStageHistory.findFirst({
      where: {
        applicationId,
        exitedAt: null,
      },
      orderBy: { enteredAt: 'desc' },
    });

    if (openHistory) {
      const enteredTime = new Date(openHistory.enteredAt).getTime();
      const actualDurationHours = Math.round(((now.getTime() - enteredTime) / (1000 * 60 * 60)) * 10) / 10;
      
      // SLA thực tế của ngân hàng = Tổng thời gian trôi qua - Thời gian tạm dừng chờ bổ sung hồ sơ
      const netWorkDurationHours = Math.max(0, Math.round((actualDurationHours - openHistory.pausedDurationHours) * 10) / 10);
      const isDelayed = netWorkDurationHours > openHistory.slaStandardHours;

      await this.prisma.applicationStageHistory.update({
        where: { id: openHistory.id },
        data: {
          exitedAt: now,
          actualDurationHours,
          netWorkDurationHours,
          isDelayed,
          handledBy: userId,
          notes: dto.notes || openHistory.notes,
        },
      });
    }

    // 4. Mở công đoạn mới (trừ khi hồ sơ đã kết thúc: APPROVED, REJECTED, CLOSED_TIMEOUT)
    const isTerminated = (
      [LoanStatus.APPROVED, LoanStatus.REJECTED, LoanStatus.CLOSED_TIMEOUT] as LoanStatus[]
    ).includes(dto.targetStatus);

    if (!isTerminated || dto.targetStage === StageCode.HOAN_TAT) {
      await this.prisma.applicationStageHistory.create({
        data: {
          applicationId,
          stageId: targetStageRecord.id,
          enteredAt: now,
          slaStandardHours: targetStageRecord.standardSlaHours,
          handledBy: userId,
          notes: dto.notes,
        },
      });
    }

    // 5. Cập nhật hồ sơ vay
    const updateData: any = {
      currentStage: dto.targetStage,
      currentStatus: dto.targetStatus,
      updatedAt: now,
    };

    if (dto.officialAmount !== undefined) {
      updateData.officialAmount = dto.officialAmount;
    }
    if (dto.approvedAmount !== undefined) {
      updateData.approvedAmount = dto.approvedAmount;
    }
    if (dto.interestRate !== undefined) {
      updateData.interestRate = dto.interestRate;
    }
    if (dto.rejectionReasonCode) {
      updateData.rejectionReasonCode = dto.rejectionReasonCode;
    }
    if (dto.rejectionNote) {
      updateData.rejectionNote = dto.rejectionNote;
    }
    if (isTerminated) {
      updateData.completedAt = now;
    }

    const updatedLoan = await this.prisma.loanApplication.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        company: true,
        assignedUser: { select: { id: true, fullName: true, username: true } },
        stageHistories: {
          include: { stage: true },
          orderBy: { enteredAt: 'asc' },
        },
        delayPredictions: {
          orderBy: { predictionTimestamp: 'desc' },
          take: 1,
        },
      },
    });

    // 6. KÍCH HOẠT DỰ BÁO AI NGUY CƠ TRỄ HẠN
    // Tự động kích hoạt khi chuyển sang THAM_DINH hoặc CAP_TREN
    if (([StageCode.THAM_DINH, StageCode.CAP_TREN] as StageCode[]).includes(dto.targetStage) && !isTerminated) {
      try {
        this.logger.log(`Tự động kích hoạt dự báo AI cho hồ sơ ${loan.applicationCode} tại công đoạn ${dto.targetStage}`);
        await this.predictionService.predictForApplication(applicationId);
      } catch (err: any) {
        this.logger.error(`Lỗi dự báo AI không cản trở luồng nghiệp vụ: ${err.message}`);
      }
    }

    return updatedLoan;
  }

  /**
   * Kiểm tra tính hợp lệ của việc chuyển trạng thái
   */
  private validateTransition(
    currentStage: StageCode,
    targetStage: StageCode,
    targetStatus: LoanStatus,
    amount: number,
  ) {
    // Không thể chuyển tiếp từ hồ sơ đã kết thúc
    if (currentStage === StageCode.HOAN_TAT) {
      throw new BadRequestException('Hồ sơ đã hoàn tất quy trình, không thể chuyển đổi trạng thái nữa.');
    }

    // Từ chối hoặc đóng hồ sơ có thể xảy ra ở bất kỳ công đoạn nào
    if (([LoanStatus.REJECTED, LoanStatus.CLOSED_TIMEOUT] as LoanStatus[]).includes(targetStatus)) {
      return;
    }

    // Kiểm tra luồng tuần tự
    if (currentStage === StageCode.TIEP_NHAN) {
      if (targetStage !== StageCode.THAM_DINH) {
        throw new BadRequestException('Từ công đoạn Tiếp nhận hồ sơ chỉ có thể chuyển sang Thẩm định.');
      }
    } else if (currentStage === StageCode.THAM_DINH) {
      // Nếu khoản vay > 10 tỷ VNĐ thì bắt buộc phải chuyển sang Hội đồng tín dụng / Cấp trên (CAP_TREN)
      if (amount > 10_000_000_000 && targetStage !== StageCode.CAP_TREN) {
        throw new BadRequestException(
          `Khoản vay ${amount.toLocaleString('vi-VN')} VNĐ vượt hạn mức chi nhánh (10 tỷ VNĐ). Bắt buộc phải trình Cấp trên / Hội đồng tín dụng phê duyệt.`
        );
      }
      if (amount <= 10_000_000_000 && targetStage === StageCode.CAP_TREN) {
        // Cho phép nếu có ghi chú đặc biệt, nhưng thông thường tại chi nhánh tự duyệt
      }
    }
  }
}
