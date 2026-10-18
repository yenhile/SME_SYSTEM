import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { LoanStatus, StageCode } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { TransitionStageDto } from './dto/transition-stage.dto';
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  constructor(private prisma: PrismaService, private predictionService: PredictionService) {}
  getWorkflowStages() { return this.prisma.workflowStage.findMany({ orderBy: { orderIndex: 'asc' } }); }
  async getWorkflowHistory(applicationId: string) {
    return this.prisma.applicationStageHistory.findMany({ where: { applicationId }, include: { stage: true, handler: { select: { id: true, fullName: true, username: true } } }, orderBy: { enteredAt: 'asc' } });
  }
  async transitionStage(applicationId: string, dto: TransitionStageDto, user: { id: string; activeRole: string }) {
    const updated = await this.prisma.$transaction(async tx => {
      // Serialize competing transitions of the same application.
      await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${applicationId} FOR UPDATE`;
      const loan = await tx.loanApplication.findUnique({ where: { id: applicationId } });
      if (!loan) throw new NotFoundException('Không tìm thấy hồ sơ.');
      if (loan.completedAt || loan.currentStage === StageCode.HOAN_TAT) throw new BadRequestException('Hồ sơ đã kết thúc, không thể chuyển trạng thái.');
      if (loan.currentStatus === LoanStatus.SUPPLEMENT_REQUIRED) throw new BadRequestException('Cần giải quyết yêu cầu bổ sung trước khi chuyển công đoạn.');
      const fromReception = loan.currentStage === StageCode.TIEP_NHAN;
      if (user.activeRole !== (fromReception ? 'CBTD' : 'THAM_QUYEN')) throw new ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
      if (fromReception && loan.assignedTo !== user.id) throw new ForbiddenException('Hồ sơ chưa được phân công cho bạn.');
      const amount = Number(loan.officialAmount || loan.proposedAmount);
      if (fromReception) {
        if (dto.targetStage !== StageCode.THAM_DINH || dto.targetStatus !== LoanStatus.PENDING_APPRAISAL) throw new BadRequestException('Tiếp nhận chỉ được chuyển sang Thẩm định.');
        if (!loan.isDocumentComplete || loan.currentStatus !== LoanStatus.CHECKED) throw new BadRequestException('Cần xác nhận đầy đủ chứng từ trước khi chuyển thẩm định.');
      } else if (dto.targetStage === StageCode.HOAN_TAT && dto.targetStatus === LoanStatus.REJECTED) {
        if (!dto.rejectionReasonCode || !dto.rejectionNote?.trim()) throw new BadRequestException('Cần mã và lý do từ chối.');
      } else if (loan.currentStage === StageCode.THAM_DINH && dto.targetStage === StageCode.CAP_TREN && dto.targetStatus === LoanStatus.WAITING_HEAD_OFFICE) {
        // Escalation follows appraisal; the existing policy also allows escalation below the limit.
      } else if (dto.targetStage === StageCode.HOAN_TAT && dto.targetStatus === LoanStatus.APPROVED) {
        if (loan.currentStage === StageCode.THAM_DINH && amount > 10000000000) throw new BadRequestException('Khoản vay vượt 10 tỷ phải trình cấp trên trước khi phê duyệt.');
        if (!Number.isFinite(dto.approvedAmount) || dto.approvedAmount! <= 0 || dto.approvedAmount! > amount) throw new BadRequestException('Số tiền phê duyệt phải dương và không vượt hạn mức.');
        if (!Number.isFinite(dto.interestRate) || dto.interestRate! < 0 || dto.interestRate! > 100) throw new BadRequestException('Lãi suất phải từ 0 đến 100%.');
      } else throw new BadRequestException('Cặp công đoạn và trạng thái không hợp lệ.');
      if (dto.officialAmount !== undefined) throw new BadRequestException('Xác định hạn mức ở công đoạn tiếp nhận, trước khi chuyển thẩm định.');
      const target = await tx.workflowStage.findUnique({ where: { stageCode: dto.targetStage } });
      if (!target) throw new BadRequestException('Chưa cấu hình công đoạn đích.');
      const now = new Date();
      const current = await tx.applicationStageHistory.findFirst({ where: { applicationId, exitedAt: null }, orderBy: { enteredAt: 'desc' } });
      if (current) {
        const actual = (now.getTime() - current.enteredAt.getTime()) / 3600000;
        const net = Math.max(0, actual - current.pausedDurationHours);
        await tx.applicationStageHistory.update({ where: { id: current.id }, data: { exitedAt: now, actualDurationHours: actual, netWorkDurationHours: net, isDelayed: net > current.slaStandardHours, handledBy: user.id } });
      }
      const terminal = dto.targetStage === StageCode.HOAN_TAT;
      await tx.applicationStageHistory.create({ data: {
        applicationId, stageId: target.id, enteredAt: now, slaStandardHours: target.standardSlaHours,
        handledBy: user.id, notes: dto.notes,
        ...(terminal ? { exitedAt: now, actualDurationHours: 0, netWorkDurationHours: 0 } : {}),
      } });
      return tx.loanApplication.update({ where: { id: applicationId }, data: {
        currentStage: dto.targetStage, currentStatus: dto.targetStatus,
        completedAt: terminal ? now : null,
        ...(dto.targetStatus === LoanStatus.APPROVED ? { approvedAmount: dto.approvedAmount, interestRate: dto.interestRate } : {}),
        ...(dto.targetStatus === LoanStatus.REJECTED ? { rejectionReasonCode: dto.rejectionReasonCode, rejectionNote: dto.rejectionNote } : {}),
      } });
    });
    if (updated.currentStage !== StageCode.HOAN_TAT) {
      try { await this.predictionService.predictForApplication(applicationId); }
      catch (err) { this.logger.warn(`Không cập nhật được dự báo AI: ${(err as Error).message}`); }
    }
    return updated;
  }
}
