import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createMetadata, metadata, revision, replay, safeView } from './portal-supplement';
import { PrismaService } from '../../prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { CreateSupplementDto } from './dto/create-supplement.dto';
import { ResolveSupplementDto } from './dto/resolve-supplement.dto';
import { LoanStatus, SupplementStatus, StageCode } from '@prisma/client';
import { SLA_POLICY_PA1, closeStagePause, openStagePause } from '../workflow/sla/sla-policy';

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
  async createSupplementRequest(applicationId: string, dto: CreateSupplementDto, userId: string, activeRole?:string, clock: Date = new Date()) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${applicationId} FOR UPDATE`;
    const loan = await tx.loanApplication.findUnique({
      where: { id: applicationId },
    });

    if (!loan) {
      throw new NotFoundException(`Không tìm thấy hồ sơ với ID: ${applicationId}`);
    }

    let portalSupplement:any;
    if(dto.items!==undefined) {
      if(activeRole!==(loan.currentStage===StageCode.TIEP_NHAN?'CBTD':'THAM_QUYEN')) throw new ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
      if(loan.currentStage===StageCode.TIEP_NHAN && loan.assignedTo!==userId) throw new ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
      portalSupplement=createMetadata(dto.items,dto.clientRequestId!);
      const fingerprint=createHash('sha256').update(JSON.stringify({requestContent:dto.requestContent,deadlineAt:dto.deadlineAt??null,notes:dto.notes??null,items:dto.items.map(item=>({documentGroup:item.documentGroup,documentTypeCode:item.documentTypeCode,period:item.period??null,reason:item.reason}))})).digest('hex');
      const linked=await tx.portalRequest.findFirst({where:{loanId:applicationId,status:'ACCEPTED'}});
      if(!linked) throw new BadRequestException('Bổ sung qua portal chỉ áp dụng hồ sơ đã tiếp nhận và liên kết Loan.');
      const previous=await tx.supplementRequest.findMany({where:{applicationId}});
      const retry=previous.find(r=>(r.portalSupplement as any)?.createId===dto.clientRequestId);
      if(retry) {
        if((retry.portalSupplement as any).createHash!==fingerprint) throw new ConflictException('Mã thao tác đã dùng cho nội dung khác.');
        return safeView(retry);
      }
      portalSupplement.createHash=fingerprint;
    } else if(dto.clientRequestId!==undefined) throw new BadRequestException('clientRequestId yêu cầu danh sách items.');

    if (loan.currentStatus === LoanStatus.SUPPLEMENT_REQUIRED) {
      throw new BadRequestException('Hồ sơ hiện đang trong trạng thái chờ bổ sung chứng từ.');
    }

    if (loan.completedAt || loan.currentStage === StageCode.HOAN_TAT) throw new BadRequestException('Hồ sơ đã kết thúc.');
    const now = clock;

    // 1. Tạo bản ghi yêu cầu bổ sung
    const request = await tx.supplementRequest.create({
      data: {
        applicationId,
        requestContent: dto.requestContent,
        requestedBy: userId,
        requestedAt: now,
        deadlineAt: dto.deadlineAt ? new Date(dto.deadlineAt) : null,
        status: SupplementStatus.PENDING,
        notes: dto.notes,
        ...(portalSupplement?{portalSupplement}:{}),
      },
      include: {
        requester: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    // 2. Tăng số lần bổ sung (supplementCount) và chuyển trạng thái hồ sơ
    await tx.loanApplication.update({
      where: { id: applicationId },
      data: {
        currentStatus: LoanStatus.SUPPLEMENT_REQUIRED,
        isDocumentComplete: false,
        supplementCount: { increment: 1 },
        updatedAt: now,
      },
    });

    // 3. TẠM DỪNG SLA: Lưu pausedAt vào bản ghi công đoạn đang diễn ra
    const activeStage = await tx.applicationStageHistory.findFirst({
      where: {
        applicationId,
        exitedAt: null,
      },
      orderBy: { enteredAt: 'desc' },
    });

    if (activeStage && !activeStage.pausedAt) {
      await tx.applicationStageHistory.update({
        where: { id: activeStage.id },
        data: { pausedAt: now },
      });
      this.logger.log(`Tạm dừng đo SLA công đoạn cho hồ sơ ${loan.applicationCode}`);
    }
    // PA1: ghi khoảng chờ doanh nghiệp (gọi lặp an toàn). Công đoạn tính theo cách cũ chỉ dùng pausedAt ở trên.
    await openStagePause(tx, applicationId, now, 'WAIT_ENTERPRISE', request.id);

    return portalSupplement?safeView(request):request;
    });
  }

  /**
   * Tiếp nhận và xử lý hoàn tất bổ sung chứng từ (UC07) - Tiếp tục đồng hồ đo SLA & Cập nhật AI
   */
  async resolveSupplementRequest(supplementId: string, dto: ResolveSupplementDto, userId: string, activeRole?:string, clock: Date = new Date()) {
    const initial = await this.prisma.supplementRequest.findUnique({ where: { id: supplementId } });
    if (!initial) throw new NotFoundException('Yêu cầu bổ sung không tồn tại.');
    let changed=false;
    const updatedRequest = await this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${initial.applicationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM supplement_requests WHERE id = ${supplementId} FOR UPDATE`;
    const request = await tx.supplementRequest.findUnique({
      where: { id: supplementId },
      include: { application: true },
    });

    if (!request) {
      throw new NotFoundException(`Không tìm thấy yêu cầu bổ sung ID: ${supplementId}`);
    }

    let m:any;
    if(request.portalSupplement) {
      if(activeRole!==(request.application.currentStage===StageCode.TIEP_NHAN?'CBTD':'THAM_QUYEN')) throw new ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
      if(request.application.currentStage===StageCode.TIEP_NHAN && request.application.assignedTo!==userId) throw new ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
      m=metadata(request);
      const fingerprint=createHash('sha256').update(JSON.stringify({notes:dto.notes??null})).digest('hex');
      if(replay(m,dto.clientRequestId,'resolve',fingerprint)) return safeView(request);
      revision(m,dto.expectedRevision);
      if(m.items.some((i:any)=>i.status!=='ACCEPTED')) throw new BadRequestException('Cần chấp nhận tất cả mục bổ sung trước khi hoàn tất.');
      m.operations.push({id:dto.clientRequestId,kind:'resolve',hash:fingerprint});m.revision++;
      m.events.push({type:'RESOLVED',at:new Date().toISOString()});
    }

    if (request.status !== SupplementStatus.PENDING) {
      throw new BadRequestException('Yêu cầu bổ sung này đã được xử lý hoàn tất trước đó.');
    }

    if (request.application.completedAt || request.application.currentStage === StageCode.HOAN_TAT) throw new BadRequestException('Hồ sơ đã kết thúc.');
    const now = clock;

    // 1. Cập nhật trạng thái yêu cầu bổ sung
    const updatedRequest = await tx.supplementRequest.update({
      where: { id: supplementId, ...(m?{portalSupplement:{equals:request.portalSupplement!}}:{}) },
      data: {
        status: SupplementStatus.RESOLVED,
        resolvedAt: now,
        notes: dto.notes ? `${request.notes ? request.notes + '\n' : ''}${dto.notes}` : request.notes,
        ...(m?{portalSupplement:m}:{}),
      },
    });

    // 2. TÍNH TOÁN VÀ TIẾP TỤC ĐỒNG HỒ SLA
    const activeStage = await tx.applicationStageHistory.findFirst({
      where: {
        applicationId: request.applicationId,
        exitedAt: null,
      },
      orderBy: { enteredAt: 'desc' },
    });

    if (activeStage && activeStage.slaPolicy === SLA_POLICY_PA1) {
      // PA1: khoảng chờ được đóng khi doanh nghiệp gửi đủ; hoàn tất bổ sung không tính thêm thời gian dừng lần hai.
      await closeStagePause(tx, request.applicationId, now);
    } else if (activeStage && activeStage.pausedAt) {
      const pausedTime = new Date(activeStage.pausedAt).getTime();
      const additionalPausedHours = Math.round(((now.getTime() - pausedTime) / (1000 * 60 * 60)) * 10) / 10;
      const totalPausedHours = Math.round((activeStage.pausedDurationHours + additionalPausedHours) * 10) / 10;

      await tx.applicationStageHistory.update({
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
      nextStatus = LoanStatus.RECEIVED;
    } else if (request.application.currentStage === StageCode.CAP_TREN) {
      nextStatus = LoanStatus.WAITING_HEAD_OFFICE;
    }

    await tx.loanApplication.update({
      where: { id: request.applicationId },
      data: {
        currentStatus: nextStatus,
        updatedAt: now,
      },
    });

    changed=true;
    return m?safeView(updatedRequest):updatedRequest;
    });
    // 4. KÍCH HOẠT LẠI DỰ BÁO AI (Vì supplement_count đã tăng, nguy cơ trễ hạn sẽ thay đổi)
    try {
      if(!changed) return updatedRequest;
      this.logger.log(`Cập nhật dự báo AI sau khi nhận chứng từ bổ sung cho hồ sơ ${initial.applicationId}`);
      await this.predictionService.predictForApplication(initial.applicationId);
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
