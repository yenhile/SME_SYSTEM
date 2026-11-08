import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.QUAN_LY, RoleCode.THAM_QUYEN)
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

  /** CBTD chỉ xem cảnh báo của hồ sơ mình phụ trách; bộ lọc theo người dùng đăng nhập, không nhận tham số từ client. */
  @Roles(RoleCode.CBTD)
  @Get('my-warnings')
  getMyWarnings(@CurrentUser() user: any) {
    return this.dashboardService.getEarlyWarningList(user, user.id);
  }

  /** Báo cáo thống kê theo khoảng thời gian: chỉ Quản lý chi nhánh. */
  @Roles(RoleCode.QUAN_LY)
  @Get('report')
  getPeriodReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboardService.getPeriodReport(from, to);
  }

  @Roles(RoleCode.QUAN_LY)
  @Get('overdue-supplements')
  getOverdueSupplements() {
    return this.dashboardService.getOverdueSupplements();
  }

  @Get('stage-distribution')
  getStageDistribution() {
    return this.dashboardService.getStageDistribution();
  }
}
