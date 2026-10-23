import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanStatus, StageCode, RoleCode } from '@prisma/client';
import { randomUUID } from 'node:crypto';

@Injectable()
export class LoanApplicationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLoanDto, creatorUserId: string) {
    if (dto.assignedTo && dto.assignedTo !== creatorUserId) throw new BadRequestException('Hồ sơ mới được gán cho cán bộ tiếp nhận. Dùng chức năng điều chuyển để đổi người phụ trách.');
    return this.prisma.$transaction(async tx => {
    // 1. Tạo hoặc cập nhật thông tin doanh nghiệp
    const company = await tx.company.upsert({
      where: { taxCode: dto.taxCode },
      update: {
        companyName: dto.companyName,
        industry: dto.industry,
        establishedYear: dto.establishedYear,
        annualRevenue: dto.annualRevenue,
        charterCapital: dto.charterCapital,
        representativeName: dto.representativeName,
        phone: dto.phone,
        address: dto.address,
      },
      create: {
        taxCode: dto.taxCode,
        companyName: dto.companyName,
        industry: dto.industry,
        establishedYear: dto.establishedYear,
        annualRevenue: dto.annualRevenue,
        charterCapital: dto.charterCapital,
        representativeName: dto.representativeName,
        phone: dto.phone,
        address: dto.address,
      },
    });

    // 2. Sinh mã hồ sơ duy nhất: SME-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    const applicationCode = `SME-${todayStr}-${seq}`;

    // Lấy stage Tiếp nhận để lấy định mức SLA
    const stageTiepNhan = await tx.workflowStage.findUnique({
      where: { stageCode: StageCode.TIEP_NHAN },
    });
    if (!stageTiepNhan) throw new BadRequestException('Chưa cấu hình công đoạn Tiếp nhận. Vui lòng liên hệ Admin.');
    const standardSla = stageTiepNhan.standardSlaHours;

    // 3. Tạo hồ sơ vay
    const assignedUser = dto.assignedTo || creatorUserId;
    const loan = await tx.loanApplication.create({
      data: {
        applicationCode,
        companyId: company.id,
        loanPurpose: dto.loanPurpose,
        loanType: dto.loanType,
        proposedAmount: dto.proposedAmount,
        loanTermMonths: dto.loanTermMonths,
        currentStage: StageCode.TIEP_NHAN,
        currentStatus: LoanStatus.RECEIVED,
        assignedTo: assignedUser,
        isDocumentComplete: false,
        supplementCount: 0,
        stageHistories: {
          create: {
            stageId: stageTiepNhan.id,
            enteredAt: new Date(),
            slaStandardHours: standardSla,
            handledBy: assignedUser,
            notes: 'Tiếp nhận hồ sơ mới vào hệ thống',
          },
        },
      },
      include: {
        company: true,
        assignedUser: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    return {
      message: 'Tiếp nhận hồ sơ thành công',
      loan,
    };
    });
  }

  async findAll(user: any, query: { stage?: StageCode; status?: LoanStatus; keyword?: string; myOnly?: boolean }) {
    if (query.stage && !Object.values(StageCode).includes(query.stage)) throw new BadRequestException('Công đoạn không hợp lệ.');
    if (query.status && !Object.values(LoanStatus).includes(query.status)) throw new BadRequestException('Trạng thái không hợp lệ.');
    const isCbtdOnly = user.roles.length === 1 && user.roles.includes(RoleCode.CBTD);
    const assignedFilter = isCbtdOnly || query.myOnly ? user.id : undefined;

    return this.prisma.loanApplication.findMany({
      where: {
        assignedTo: assignedFilter,
        currentStage: query.stage,
        currentStatus: query.status,
        OR: query.keyword
          ? [
              { applicationCode: { contains: query.keyword, mode: 'insensitive' } },
              { company: { companyName: { contains: query.keyword, mode: 'insensitive' } } },
              { company: { taxCode: { contains: query.keyword } } },
            ]
          : undefined,
      },
      include: {
        company: true,
        assignedUser: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        delayPredictions: {
          orderBy: { predictionTimestamp: 'desc' },
          take: 1,
        },
        stageHistories: {
          orderBy: { enteredAt: 'desc' },
          take: 1,
          include: { stage: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: {
        company: true,
        portalRequest: { include: { documents: { where: { withdrawnAt: null, nextVersion: { is: null } }, select: { id: true, documentGroup: true, fileName: true, fileSize: true, uploadedAt: true, coverage: true, version: true, supersedesId: true, withdrawnAt: true } } } },
        assignedUser: {
          select: { id: true, fullName: true, username: true, email: true, phone: true },
        },
        stageHistories: {
          orderBy: { enteredAt: 'asc' },
          include: {
            stage: true,
            handler: { select: { fullName: true, username: true } },
          },
        },
        documents: {
          include: {
            uploader: { select: { fullName: true } },
          },
          orderBy: { uploadedAt: 'desc' },
        },
        supplementRequests: {
          include: {
            requester: { select: { fullName: true } },
          },
          orderBy: { requestedAt: 'desc' },
        },
        delayPredictions: {
          orderBy: { predictionTimestamp: 'desc' },
          take: 1,
        },
        assignments: {
          include: {
            fromUser: { select: { fullName: true } },
            toUser: { select: { fullName: true } },
            manager: { select: { fullName: true } },
          },
          orderBy: { reassignedAt: 'desc' },
        },
      },
    });

    if (!loan) throw new NotFoundException('Không tìm thấy hồ sơ vay.');
    return loan;
  }

  async checkDocuments(id: string, isComplete: boolean) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${id} FOR UPDATE`;
    const loan = await tx.loanApplication.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Hồ sơ không tồn tại.');
    if (typeof isComplete !== 'boolean') throw new BadRequestException('isComplete phải là giá trị boolean.');
    if (loan.currentStage !== StageCode.TIEP_NHAN || loan.currentStatus === LoanStatus.SUPPLEMENT_REQUIRED) throw new BadRequestException('Chỉ kiểm tra chứng từ tại công đoạn Tiếp nhận khi không chờ bổ sung.');

    const updated = await tx.loanApplication.update({
      where: { id },
      data: {
        isDocumentComplete: isComplete,
        currentStatus: isComplete ? LoanStatus.CHECKED : LoanStatus.RECEIVED,
      },
    });

    return {
      message: isComplete ? 'Xác nhận hồ sơ đã đầy đủ chứng từ' : 'Đã hủy xác nhận đầy đủ chứng từ',
      loan: updated,
    };
    });
  }

  async setOfficialAmount(id: string, officialAmount: number) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${id} FOR UPDATE`;
    const loan = await tx.loanApplication.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Hồ sơ không tồn tại.');

    if (loan.currentStage !== StageCode.TIEP_NHAN || loan.currentStatus === LoanStatus.SUPPLEMENT_REQUIRED) throw new BadRequestException('Chỉ xác định hạn mức tại công đoạn Tiếp nhận khi không chờ bổ sung.');
    if (!Number.isFinite(officialAmount) || officialAmount <= 0) {
      throw new BadRequestException('Hạn mức vay phải là số dương hợp lệ.');
    }

    const updated = await tx.loanApplication.update({
      where: { id },
      data: {
        officialAmount,
      },
    });

    const isExceedLimit = officialAmount > 10000000000;

    return {
      message: 'Đã xác định hạn mức khoản vay thành công',
      loan: updated,
      isExceedLimit,
      nextAction: isExceedLimit ? 'CHUYEN_CAP_TREN' : 'CHUYEN_THAM_DINH',
    };
    });
  }
}
