import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { LoanStatus, StageCode, SupplementStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { CloseOverdueDto } from './dto/close-overdue.dto';
import { overdueAt as supplementDueAt } from '../supplements/supplement-deadlines';
import { waitingOn } from '../supplements/portal-supplement';
import { computeStageClosing, loadPauseIntervals, resolveStageSla } from './sla/sla-policy';
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  constructor(private prisma: PrismaService, private predictionService: PredictionService) {}
  getWorkflowStages() { return this.prisma.workflowStage.findMany({ orderBy: { orderIndex: 'asc' } }); }
  async getWorkflowHistory(applicationId: string) {
    return this.prisma.applicationStageHistory.findMany({ where: { applicationId }, include: { stage: true, handler: { select: { id: true, fullName: true, username: true } } }, orderBy: { enteredAt: 'asc' } });
  }
  async transitionStage(applicationId: string, dto: TransitionStageDto, user: { id: string; activeRole: string }, clock: Date = new Date()) {
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
      if (!fromReception && loan.assignedTo === user.id) throw new ForbiddenException('Bạn đã xử lý hồ sơ này ở công đoạn Tiếp nhận nên không được tự thẩm định hoặc phê duyệt.');
      if (!fromReception && loan.assignedTo === user.id) throw new ForbiddenException('Bạn đã xử lý hồ sơ này ở công đoạn Tiếp nhận nên không được tự thẩm định hoặc phê duyệt.');
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
      const now = clock;
      const terminal = dto.targetStage === StageCode.HOAN_TAT;
      // Cách tính của công đoạn mới được chốt ngay lúc mở; công đoạn đang mở giữ cách tính đã lưu của nó.
      const mode = await resolveStageSla(tx, now, !terminal);
      const current = await tx.applicationStageHistory.findFirst({ where: { applicationId, exitedAt: null }, orderBy: { enteredAt: 'desc' } });
      if (current) {
        const closing = computeStageClosing(current, await loadPauseIntervals(tx, current.id, current.slaPolicy), now);
        await tx.applicationStageHistory.update({ where: { id: current.id }, data: { exitedAt: now, ...closing, handledBy: user.id } });
      }
      await tx.applicationStageHistory.create({ data: {
        applicationId, stageId: target.id, enteredAt: now, slaStandardHours: target.standardSlaHours,
        handledBy: user.id, notes: dto.notes, ...mode,
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

  /**
   * DEC-02 / TK-08: Quản lý đóng thủ công hồ sơ đã quá hạn bổ sung sang CLOSED_TIMEOUT.
   * Không có đường đóng tự động. Hồ sơ vào công đoạn HOAN_TAT nên mọi thao tác ghi sau đó bị khóa.
   */
  async closeOverdueSupplement(applicationId: string, dto: CloseOverdueDto, user: { id: string; activeRole: string }, now: Date = new Date()) {
    if (user.activeRole !== 'QUAN_LY') throw new ForbiddenException('Chỉ Quản lý được đóng hồ sơ quá hạn bổ sung.');
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Cần nhập lý do đóng hồ sơ.');
    return this.prisma.$transaction(async tx => {
      // Khóa hồ sơ để không tranh chấp với hoàn tất bổ sung hoặc chuyển bước.
      await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${applicationId} FOR UPDATE`;
      const loan = await tx.loanApplication.findUnique({ where: { id: applicationId } });
      if (!loan) throw new NotFoundException('Không tìm thấy hồ sơ.');
      if (loan.assignedTo === user.id) throw new ForbiddenException('Bạn đang phụ trách hồ sơ này nên không được tự đóng hồ sơ.');
      if (loan.completedAt || loan.currentStage === StageCode.HOAN_TAT) throw new BadRequestException('Hồ sơ đã kết thúc.');
      if (loan.currentStatus !== LoanStatus.SUPPLEMENT_REQUIRED) throw new BadRequestException('Chỉ đóng được hồ sơ đang chờ bổ sung.');
      const pending = await tx.supplementRequest.findMany({ where: { applicationId, status: SupplementStatus.PENDING } });
      // Chỉ yêu cầu còn chờ doanh nghiệp mới được tính quá hạn; doanh nghiệp đã gửi đủ thì ngân hàng phải kiểm tra, không đóng thay.
      if (!pending.some(item => waitingOn(item) === 'ENTERPRISE' && supplementDueAt(item.requestedAt, item.deadlineAt).getTime() <= now.getTime())) {
        throw new BadRequestException('Hồ sơ chưa quá hạn bổ sung.');
      }
      const target = await tx.workflowStage.findUnique({ where: { stageCode: StageCode.HOAN_TAT } });
      if (!target) throw new BadRequestException('Chưa cấu hình công đoạn kết thúc.');

      await tx.supplementRequest.updateMany({ where: { applicationId, status: SupplementStatus.PENDING }, data: { status: SupplementStatus.EXPIRED } });

      // Hồ sơ đang chờ bổ sung nên đồng hồ SLA đang tạm dừng: tính nốt thời gian tạm dừng trước khi đóng công đoạn.
      const mode = await resolveStageSla(tx, now, false);
      const current = await tx.applicationStageHistory.findFirst({ where: { applicationId, exitedAt: null }, orderBy: { enteredAt: 'desc' } });
      if (current) {
        const closing = computeStageClosing(current, await loadPauseIntervals(tx, current.id, current.slaPolicy), now);
        await tx.applicationStageHistory.update({ where: { id: current.id }, data: { exitedAt: now, pausedAt: null, ...closing, handledBy: user.id } });
        // Khoảng dừng PA1 còn mở được đóng cùng công đoạn để không còn khoảng "đang dừng" trên công đoạn đã kết thúc.
        await tx.applicationStagePause.updateMany({ where: { historyId: current.id, endedAt: null }, data: { endedAt: now } });
      }
      await tx.applicationStageHistory.create({ data: {
        applicationId, stageId: target.id, enteredAt: now, exitedAt: now, actualDurationHours: 0, netWorkDurationHours: 0,
        slaStandardHours: target.standardSlaHours, handledBy: user.id, ...mode,
        notes: `Đóng hồ sơ do quá hạn bổ sung: ${reason}`,
      } });
      return tx.loanApplication.update({ where: { id: applicationId }, data: {
        currentStage: StageCode.HOAN_TAT, currentStatus: LoanStatus.CLOSED_TIMEOUT, completedAt: now, rejectionReasonCode: 'TC05', rejectionNote: reason, updatedAt: now,
      } });
    });
  }
}
