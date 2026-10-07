import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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
