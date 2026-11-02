import {transferLoan,assignmentPrediction} from './assignment.transactions';
import {officerWorkloads} from './officer-workloads';
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { ReassignOfficerDto } from './dto/reassign-officer.dto';
import { RoleCode, LoanStatus } from '@prisma/client';

import { lockOfficer } from '../workflow/loan-policy';

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
  getOfficerWorkloads() { return officerWorkloads(this.prisma); }

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
  async reassign(applicationId:string,dto:ReassignOfficerDto,managerId:string) {
    const result=await this.prisma.$transaction(tx=>transferLoan(tx,applicationId,dto,managerId));
    const prediction=await assignmentPrediction(this.predictionService,applicationId,result.replayed);
    return{assignment:result.assignmentRecord,loan:result.updatedLoan,replayed:result.replayed,prediction};
  }
}
