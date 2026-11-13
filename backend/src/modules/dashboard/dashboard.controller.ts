import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.QUAN_LY, RoleCode.THAM_QUYEN, RoleCode.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverviewStats() {
    return this.dashboardService.getOverviewStats();
  }

  @Get('sla-bottlenecks')
  getSlaBottleneckAnalysis() {
    return this.dashboardService.getSlaBottleneckAnalysis();
  }

  @Get('early-warnings')
  getEarlyWarningList(@CurrentUser() user: any) {
    return this.dashboardService.getEarlyWarningList(user);
  }

  /** CBTD chỉ xem cảnh báo của hồ sơ mình phụ trách và đang chờ chính mình xử lý; lọc theo người đăng nhập, không nhận tham số từ client. */
  @Roles(RoleCode.CBTD)
  @Get('my-warnings')
  getMyWarnings(@CurrentUser() user: any) {
    return this.dashboardService.getEarlyWarningList(user, user.id, { officerTurnOnly: true });
  }

  /** Báo cáo thống kê theo khoảng thời gian: chỉ Quản lý chi nhánh. */
  @Roles(RoleCode.QUAN_LY, RoleCode.ADMIN)
  @Get('report')
  getPeriodReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboardService.getPeriodReport(from, to);
  }

  @Roles(RoleCode.QUAN_LY, RoleCode.ADMIN)
  @Get('overdue-supplements')
  getOverdueSupplements() {
    return this.dashboardService.getOverdueSupplements();
  }

  @Get('operations')
  getOperations(@CurrentUser() user: any, @Query() query: any) {
    return this.dashboardService.getOperations(user, { stage: query.stage, officerId: query.officerId, page: query.page, pageSize: query.pageSize });
  }

  /** CBTD chỉ xem hồ sơ mình phụ trách; phạm vi lấy từ người đăng nhập, không nhận tham số cán bộ từ client. */
  @Roles(RoleCode.CBTD)
  @Get('officer')
  getOfficerDashboard(@CurrentUser() user: any, @Query() query: any) {
    return this.dashboardService.getOfficerDashboard(user, { page: query.page, pageSize: query.pageSize });
  }

  @Roles(RoleCode.THAM_QUYEN)
  @Get('approver')
  getApproverDashboard(@CurrentUser() user: any) {
    return this.dashboardService.getApproverDashboard(user);
  }

  @Get('stage-distribution')
  getStageDistribution() {
    return this.dashboardService.getStageDistribution();
  }
}
