import {assertNoCompanyConflict} from '../assignments/assignment-coordination';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanStatus, LoanType, Prisma, StageCode, RoleCode } from '@prisma/client';
import { compareLoanQueue } from './loan-queue';
import { assertQueueRequest, classifyQueueRow, QUEUE_GROUPS, type QueueActor, type QueueGroup, type QueueReason } from './appraisal-queue';
import { isEvidenceChanged } from '../appraisal/appraisal.logic';
import { nextDocumentCode } from '../../common/document-codes';
import { assertOfficerMayWriteCompany } from '../companies/company-access';
import { companySnapshot, lockCompany, withLoanCompany } from '../companies/company-snapshot';
import { SLA_POLICY_PA1, computeStageClosing, resolveStageSla, stageSlaSummary } from '../workflow/sla/sla-policy';
import { firstStagePolicies, predictionStatusOf } from '../prediction/prediction-status';

import { assertLoanWrite, assertBranchAmount, assertOfficialAmount, BRANCH_POLICY, lockOfficer } from '../workflow/loan-policy';

export interface LoanListQuery {
  stage?: StageCode;
  status?: LoanStatus;
  keyword?: string;
  myOnly?: boolean;
  code?: string;
  company?: string;
  loanType?: string;
  officer?: string;
  overdueOnly?: string;
  page?: string;
  pageSize?: string;
  queue?: string;
  sort?: string;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const EVIDENCE_BATCH_SIZE = 5;
const AUTHOR_EVENTS = ['DRAFT_SAVED', 'SUBMITTED'];

function positiveInteger(value: string, label: string, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new BadRequestException(`${label} không hợp lệ.`);
  return parsed;
}

const RANK_STAGE = {
  orderBy: { enteredAt: 'desc' as const },
  take: 1,
  select: {
    enteredAt: true, exitedAt: true, pausedAt: true, pausedDurationHours: true, slaStandardHours: true, slaPolicy: true, slaCalendarVersion: true,
    pauses: { select: { startedAt: true, endedAt: true } },
  },
};

const LIST_INCLUDE = {
  company: true,
  assignedUser: { select: { id: true, fullName: true, username: true, email: true } },
  delayPredictions: { orderBy: { predictionTimestamp: 'desc' as const }, take: 1 },
  stageHistories: {
    orderBy: { enteredAt: 'desc' as const },
    take: 1,
    include: {
      stage: true,
      handler: { select: { fullName: true, username: true } },
      pauses: { orderBy: { startedAt: 'asc' as const }, select: { startedAt: true, endedAt: true } },
    },
  },
  supplementRequests: {
    where: { status: 'PENDING' as const },
    select: { id: true, status: true, requestedAt: true, deadlineAt: true, reminderSentAt: true, overdueAt: true },
  },
  appraisalReport: { select: { status: true, versions: { orderBy: { sequence: 'desc' as const }, take: 1, select: { sequence: true, submittedAt: true } } } },
  portalRequest: { select: { id: true } },
  _count: { select: { documents: true } },
};

@Injectable()
export class LoanApplicationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLoanDto, creatorUserId: string, clock: Date = new Date()) {
    assertBranchAmount(dto.proposedAmount);
    if (dto.assignedTo && dto.assignedTo !== creatorUserId) throw new BadRequestException('Hồ sơ mới được gán cho cán bộ tiếp nhận. Dùng chức năng điều chuyển để đổi người phụ trách.');
    return this.prisma.$transaction(async tx => {
    await lockOfficer(tx,creatorUserId);
    const actor=await tx.user.findFirst({where:{id:creatorUserId,isActive:true,roles:{some:{role:{code:'CBTD'}}}}});
    if(!actor) throw new BadRequestException('CBTD không còn hoạt động hoặc đã mất quyền.');
    // 1. Tạo hoặc cập nhật thông tin doanh nghiệp (không ghi đè doanh nghiệp của cán bộ khác)
    await assertNoCompanyConflict(tx,creatorUserId,dto.taxCode);
    await lockCompany(tx,dto.taxCode);
    await assertOfficerMayWriteCompany(tx, dto.taxCode, creatorUserId);
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

    // Lấy stage Tiếp nhận để lấy định mức SLA
    const stageTiepNhan = await tx.workflowStage.findUnique({
      where: { stageCode: StageCode.TIEP_NHAN },
    });
    if (!stageTiepNhan) throw new BadRequestException('Chưa cấu hình công đoạn Tiếp nhận. Vui lòng liên hệ Admin.');
    const standardSla = stageTiepNhan.standardSlaHours;
    // SLA hồ sơ vay bắt đầu từ lúc tiếp nhận; cách tính được chốt tại đây (cũ hoặc PA1 theo mốc kích hoạt).
    const slaMode = await resolveStageSla(tx, clock);

    // 3. Tạo hồ sơ vay
    const assignedUser = dto.assignedTo || creatorUserId;
    const loan = await tx.loanApplication.create({
      data: {
        applicationCode: await nextDocumentCode(tx, 'SME'),
        businessPolicyVersion: BRANCH_POLICY, intakeOfficerId: creatorUserId,
        companyId: company.id,
        companySnapshot: companySnapshot(company),
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
            enteredAt: clock,
            slaStandardHours: standardSla,
            ...slaMode,
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
      loan:withLoanCompany(loan),
    };
    });
  }

  private listWhere(user: any, query: LoanListQuery): Prisma.LoanApplicationWhereInput {
    if (query.stage && !Object.values(StageCode).includes(query.stage)) throw new BadRequestException('Công đoạn không hợp lệ.');
    if (query.status && !Object.values(LoanStatus).includes(query.status)) throw new BadRequestException('Trạng thái không hợp lệ.');
    if (query.loanType && !Object.values(LoanType).includes(query.loanType as LoanType)) throw new BadRequestException('Loại vay không hợp lệ.');
    const isCbtdOnly = user.roles.length === 1 && user.roles.includes(RoleCode.CBTD);
    const assignedFilter = isCbtdOnly || query.myOnly ? user.id : undefined;
    // Thẩm quyền chỉ thấy hồ sơ từ công đoạn Thẩm định trở đi (không thấy hồ sơ còn ở Tiếp nhận).
    const stageFilter = user.activeRole === RoleCode.THAM_QUYEN
      ? { not: StageCode.TIEP_NHAN, ...(query.stage ? { equals: query.stage } : {}) }
      : query.stage;

    const conditions: Prisma.LoanApplicationWhereInput[] = [];
    if (query.company) {
      conditions.push({ OR: [
        { company: { companyName: { contains: query.company, mode: 'insensitive' } } },
        { companySnapshot: { path: ['companyName'], string_contains: query.company, mode: 'insensitive' } },
        { company: { taxCode: { contains: query.company } } },
      ] });
    }
    if (query.officer && !isCbtdOnly) {
      conditions.push({ assignedUser: { OR: [
        { fullName: { contains: query.officer, mode: 'insensitive' } },
        { username: { contains: query.officer, mode: 'insensitive' } },
      ] } });
    }

    return {
      assignedTo: assignedFilter,
      currentStage: stageFilter,
      currentStatus: query.status,
      ...(query.code ? { applicationCode: { contains: query.code, mode: 'insensitive' as const } } : {}),
      ...(query.loanType ? { loanType: query.loanType as LoanType } : {}),
      ...(conditions.length ? { AND: conditions } : {}),
      OR: query.keyword
        ? [
            { applicationCode: { contains: query.keyword, mode: 'insensitive' } },
            { company: { companyName: { contains: query.keyword, mode: 'insensitive' } } },
            { companySnapshot: { path: ['companyName'], string_contains: query.keyword, mode: 'insensitive' } },
            { company: { taxCode: { contains: query.keyword } } },
          ]
        : undefined,
    };
  }

  private async listRows(where: Prisma.LoanApplicationWhereInput, now: Date) {
    const loans = await this.prisma.loanApplication.findMany({ where, include: LIST_INCLUDE, orderBy: { createdAt: 'desc' } });
    const policies = await firstStagePolicies(this.prisma, loans.map(loan => loan.id));
    return loans.map(loan => {
      const latest = loan.stageHistories?.[0];
      const slaSummary = latest?.exitedAt === null
        ? stageSlaSummary(latest, (latest.pauses ?? []).map(p => ({ start: p.startedAt, end: p.endedAt })), now)
        : null;
      const { appraisalReport, portalRequest, _count, ...row } = withLoanCompany(loan);
      return {
        ...row,
        predictionStatus: predictionStatusOf(loan.delayPredictions.length > 0, policies.get(loan.id)),
        slaSummary,
        reportStatus: appraisalReport?.status ?? null,
        reportVersion: appraisalReport?.versions?.[0] ? { sequence: appraisalReport.versions[0].sequence, submittedAt: appraisalReport.versions[0].submittedAt } : null,
        source: portalRequest ? 'PORTAL' : 'QUAY',
        documentCount: _count?.documents ?? 0,
      };
    });
  }

  /** Thứ tự theo hạn SLA được tính ở máy chủ nên phải xếp hạng cả tập lọc trước khi cắt trang; chỉ nạp đầy đủ các dòng của trang đang xem. */
  private async listPage(where: Prisma.LoanApplicationWhereInput, query: LoanListQuery, now: Date) {
    const page = positiveInteger(query.page ?? '1', 'Trang');
    const pageSize = query.pageSize === undefined ? DEFAULT_PAGE_SIZE : positiveInteger(query.pageSize, 'Số dòng mỗi trang', MAX_PAGE_SIZE);
    const candidates = await this.prisma.loanApplication.findMany({
      where,
      select: { id: true, currentStage: true, completedAt: true, createdAt: true, updatedAt: true, stageHistories: RANK_STAGE },
    });
    const ranked = candidates.map(loan => ({ ...this.rankRow(loan, now), updatedAt: loan.updatedAt }));
    const matching = query.overdueOnly === 'true' ? ranked.filter(row => row.sla?.isOverdue) : ranked;
    const ordered = query.sort === 'updated' ? [...matching].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()) : [...matching].sort(compareLoanQueue);
    const ids = ordered.slice((page - 1) * pageSize, page * pageSize).map(row => row.id);
    return { items: await this.pageRows(ids, now), total: matching.length, page, pageSize };
  }

  private rankRow(loan: { id: string; currentStage: StageCode; completedAt: Date | null; createdAt: Date; stageHistories?: any[] }, now: Date) {
    const latest = loan.stageHistories?.[0];
    const sla = latest?.exitedAt === null ? stageSlaSummary(latest, (latest.pauses ?? []).map((p: any) => ({ start: p.startedAt, end: p.endedAt })), now) : null;
    return { id: loan.id, currentStage: loan.currentStage, completedAt: loan.completedAt, createdAt: loan.createdAt, sla };
  }

  private async pageRows(ids: string[], now: Date) {
    const rows = ids.length ? await this.listRows({ id: { in: ids } }, now) : [];
    const position = new Map(ids.map((id, index) => [id, index]));
    return rows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
  }

  /** Xếp từng hồ sơ đang ở Thẩm định vào đúng một nhóm theo cùng điều kiện mà trang thẩm định dùng để hiện nút quyết định. */
  private async queuePage(user: QueueActor & { roles: RoleCode[] }, group: QueueGroup, query: LoanListQuery, now: Date) {
    const page = positiveInteger(query.page ?? '1', 'Trang');
    const pageSize = query.pageSize === undefined ? DEFAULT_PAGE_SIZE : positiveInteger(query.pageSize, 'Số dòng mỗi trang', MAX_PAGE_SIZE);
    const candidates = await this.prisma.loanApplication.findMany({
      where: { ...this.listWhere(user, { ...query, stage: StageCode.THAM_DINH, status: undefined }), completedAt: null },
      select: {
        id: true, currentStage: true, currentStatus: true, completedAt: true, createdAt: true, assignedTo: true, intakeOfficerId: true, businessPolicyVersion: true,
        companyId: true, companySnapshot: true, proposedAmount: true, officialAmount: true, loanPurpose: true, loanType: true, loanTermMonths: true,
        stageHistories: RANK_STAGE,
        supplementRequests: { where: { status: 'PENDING' }, select: { id: true } },
        coordinationRequests: { where: { status: 'PENDING', reasonCode: 'CONFLICT_OF_INTEREST' }, select: { id: true } },
        appraisalReport: { select: { status: true, versions: { orderBy: { sequence: 'desc' }, take: 1, select: { evidenceHash: true } }, events: { where: { actorId: user.id, kind: { in: AUTHOR_EVENTS } }, take: 1, select: { id: true } } } },
      },
    });

    const changed = new Set<string>();
    const toCheck = candidates.filter(loan => classifyQueueRow(loan, false, user).reason === 'SUBMITTED');
    for (let start = 0; start < toCheck.length; start += EVIDENCE_BATCH_SIZE) {
      await Promise.all(toCheck.slice(start, start + EVIDENCE_BATCH_SIZE).map(async loan => {
        if (await isEvidenceChanged(this.prisma, loan, loan.appraisalReport!.versions[0].evidenceHash)) changed.add(loan.id);
      }));
    }

    const groupCounts = Object.fromEntries(QUEUE_GROUPS.map(name => [name, 0])) as Record<QueueGroup, number>;
    const reasons = new Map<string, QueueReason>();
    const matching = candidates.flatMap(loan => {
      const placed = classifyQueueRow(loan, changed.has(loan.id), user);
      groupCounts[placed.group] += 1;
      reasons.set(loan.id, placed.reason);
      return placed.group === group ? [this.rankRow(loan, now)] : [];
    });
    const ids = matching.sort(compareLoanQueue).slice((page - 1) * pageSize, page * pageSize).map(row => row.id);
    const items = (await this.pageRows(ids, now)).map(row => ({ ...row, queueReason: reasons.get(row.id) }));
    return { items, total: matching.length, page, pageSize, groupCounts };
  }

  async findAll(user: any, query: LoanListQuery) {
    if (query.sort !== undefined && query.sort !== 'updated') throw new BadRequestException('Cách sắp xếp không hợp lệ.');
    const now = new Date();
    if (query.queue !== undefined) return this.queuePage(user, assertQueueRequest(query.queue, user), query, now);
    const where = this.listWhere(user, query);
    return query.page === undefined ? this.listRows(where, now) : this.listPage(where, query, now);
  }

  async findOne(id: string, now: Date = new Date(),actor?:{id:string}) {
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
    // Trạng thái SLA hiện tại: công đoạn đang mở dùng cách tính nào, đang chạy hay đang chờ ai (C.9.2, mốc 3).
    const open = loan.stageHistories.find(h => h.exitedAt === null);
    const isPa1 = open?.slaPolicy === SLA_POLICY_PA1;
    const pauses = isPa1 ? await this.prisma.applicationStagePause.findMany({ where: { historyId: open!.id }, orderBy: { startedAt: 'asc' } }) : [];
    const pauseOpen = pauses.some(pause => pause.endedAt === null);
    let liveSla: Record<string, unknown> | null = null;
    if (open && isPa1) {
      try {
        liveSla = { historyId: open.id, ...computeStageClosing(open, pauses.map(p => ({ start: p.startedAt, end: p.endedAt })), now) };
      } catch (error) {
        liveSla = { historyId: open.id, error: (error as Error).message };
      }
    }
    const supplementOpen = loan.currentStatus === LoanStatus.SUPPLEMENT_REQUIRED;
    const slaState = {
      policy: open?.slaPolicy ?? null,
      calendarVersion: open?.slaCalendarVersion ?? null,
      // Cách PA1: có khoảng dừng mở = chờ doanh nghiệp; không có mà hồ sơ còn yêu cầu bổ sung = ngân hàng đang kiểm tra (SLA chạy).
      waiting: supplementOpen ? (isPa1 ? (pauseOpen ? 'ENTERPRISE' : 'BANK') : 'ENTERPRISE') : null,
      slaRunning: open ? (isPa1 ? !pauseOpen : !open.pausedAt) : false,
    };
    return {
      ...withLoanCompany(loan),
      source: loan.portalRequest ? 'PORTAL' : 'QUAY',
      coordinationRestrictions:await this.coordinationRestrictions(id,actor?.id),
      makerCheckerRestrictions:await this.makerCheckerRestrictions(loan,actor?.id),
      predictionStatus: predictionStatusOf(loan.delayPredictions.length > 0, loan.stageHistories[0]?.slaPolicy),
      slaState,
      liveSla,
      slaSummary: open ? stageSlaSummary(open, pauses.map(p => ({ start: p.startedAt, end: p.endedAt })), now) : null,
    };
  }

  private async makerCheckerRestrictions(loan: { id: string; assignedTo?: string | null; intakeOfficerId?: string | null }, actorId?: string) {
    if (!actorId) {
      return {
        isIndependent: true,
        decisionBlocked: false,
        decisionBlockReason: null,
        canCloseOverdue: true,
        closeOverdueBlockReason: null,
      };
    }

    // D4-04: Close Overdue restrictions for QLCN
    let canCloseOverdue = true;
    let closeOverdueBlockReason: string | null = null;
    if (loan.assignedTo === actorId) {
      canCloseOverdue = false;
      closeOverdueBlockReason = 'Bạn đang phụ trách hồ sơ này nên không được đóng hồ sơ quá hạn (Maker-Checker).';
    } else if (loan.intakeOfficerId && loan.intakeOfficerId === actorId) {
      canCloseOverdue = false;
      closeOverdueBlockReason = 'Bạn là người tiếp nhận ban đầu của hồ sơ này nên không được đóng hồ sơ quá hạn (Maker-Checker).';
    }

    // D5-04: Decision (Approve / Reject) & Clarification restrictions
    let isIndependent = true;
    let decisionBlockReason: string | null = null;
    if (loan.assignedTo === actorId) {
      isIndependent = false;
      decisionBlockReason = 'Bạn đang phụ trách hồ sơ này nên không được tự quyết định hoặc yêu cầu làm rõ (Maker-Checker).';
    } else if (loan.intakeOfficerId && loan.intakeOfficerId === actorId) {
      isIndependent = false;
      decisionBlockReason = 'Bạn là người tiếp nhận ban đầu của hồ sơ này nên không được tự quyết định hoặc yêu cầu làm rõ (Maker-Checker).';
    } else {
      const authored = await this.prisma.appraisalReportEvent.findFirst({
        where: {
          report: { applicationId: loan.id },
          actorId,
          kind: { in: ['DRAFT_SAVED', 'SUBMITTED'] },
        },
      });
      if (authored) {
        isIndependent = false;
        decisionBlockReason = 'Bạn đã tham gia lập hoặc sửa tờ trình nên không được tự quyết định hoặc yêu cầu làm rõ (Maker-Checker).';
      }
    }

    return {
      isIndependent,
      decisionBlocked: !isIndependent,
      decisionBlockReason,
      canCloseOverdue,
      closeOverdueBlockReason,
    };
  }

  private async coordinationRestrictions(id:string,actorId?:string){
    const pending=await this.prisma.assignmentChangeRequest.findMany({where:{applicationId:id,status:'PENDING',reasonCode:'CONFLICT_OF_INTEREST'},select:{requestedById:true}});
    return{writeBlocked:pending.some(r=>r.requestedById===actorId),decisionBlocked:pending.length>0};
  }
  async checkDocuments(id: string, isComplete: boolean, actor: {id:string;activeRole:string}) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${id} FOR UPDATE`;
    const loan = await tx.loanApplication.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Hồ sơ không tồn tại.');
    await assertLoanWrite(tx,loan,actor,true);
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

  async setOfficialAmount(id: string, officialAmount: number, actor: {id:string;activeRole:string}) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${id} FOR UPDATE`;
    const loan = await tx.loanApplication.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Hồ sơ không tồn tại.');
    await assertLoanWrite(tx,loan,actor,true);

    if (loan.currentStage !== StageCode.TIEP_NHAN || loan.currentStatus === LoanStatus.SUPPLEMENT_REQUIRED) throw new BadRequestException('Chỉ xác định hạn mức tại công đoạn Tiếp nhận khi không chờ bổ sung.');
    assertOfficialAmount(officialAmount, loan.proposedAmount);

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
      nextAction: 'CHUYEN_THAM_DINH',
    };
    });
  }
}
