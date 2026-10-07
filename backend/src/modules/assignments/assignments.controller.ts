import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { ReassignOfficerDto } from './dto/reassign-officer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleCode } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /**
   * Lấy tải công việc của toàn bộ cán bộ tín dụng
   */
  @Get('officer-workloads')
  getOfficerWorkloads() {
    return this.assignmentsService.getOfficerWorkloads();
  }

  /**
   * Lấy lịch sử điều chuyển của một hồ sơ
   */
  @Get(':applicationId/history')
  getAssignmentHistory(@Param('applicationId') applicationId: string) {
    return this.assignmentsService.getAssignmentHistory(applicationId);
  }

  /**
   * Điều chuyển hồ sơ sang cán bộ tín dụng khác (Chỉ Quản lý hoặc Admin)
   */
  @Post(':applicationId/reassign')
  @Roles(RoleCode.QUAN_LY, RoleCode.ADMIN)
  reassign(
    @Param('applicationId') applicationId: string,
    @Body() dto: ReassignOfficerDto,
    @CurrentUser('id') managerId: string,
  ) {
    return this.assignmentsService.reassign(applicationId, dto, managerId);
  }
}
