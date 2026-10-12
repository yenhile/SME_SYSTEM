import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

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
  getEarlyWarningList() {
    return this.dashboardService.getEarlyWarningList();
  }

  @Get('stage-distribution')
  getStageDistribution() {
    return this.dashboardService.getStageDistribution();
  }
}
