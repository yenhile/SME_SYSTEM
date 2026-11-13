import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { IsDivisibleBy, IsInt, IsNumber, IsString, Min } from 'class-validator';
import { RoleCode, StageCode } from '@prisma/client';
import { AdminService } from './admin.service';
import type { AuditLogQuery } from './admin-audit';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { Roles } from './common/decorators/roles.decorator';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

export class UpdateSlaDto {
  @IsInt({ message: 'Định mức SLA phải là số giờ nguyên.' })
  @Min(4, { message: 'Định mức SLA tối thiểu là 0,5 ngày làm việc (4 giờ).' })
  @IsDivisibleBy(4, { message: 'Định mức SLA phải theo bước 0,5 ngày làm việc (bội số của 4 giờ).' })
  standardSlaHours: number;
}
export class CreateRateBandDto {
  @IsString({ message: 'Loại vay không hợp lệ.' })
  loanType: string;
  @IsNumber({}, { message: 'Sàn phải là số.' })
  minRate: number;
  @IsNumber({}, { message: 'Trần phải là số.' })
  maxRate: number;
  @IsString({ message: 'Hiệu lực từ phải là ngày dạng YYYY-MM-DD.' })
  effectiveDate: string;
  @IsString({ message: 'Căn cứ ban hành bắt buộc.' })
  basis: string;
}
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('dashboard')
  dashboard() { return this.admin.dashboard(); }

  @Get('workflow-stages')
  stages() { return this.admin.stages(); }
  @Put('workflow-stages/:code')
  updateStage(@Param('code', new ParseEnumPipe(StageCode)) code: StageCode, @Body() body: UpdateSlaDto, @CurrentUser('id') actorId: string) {
    return this.admin.updateStageSla(code, body, actorId);
  }
  @Get('interest-rate-bands')
  rateBands() { return this.admin.rateBands(); }
  @Post('interest-rate-bands')
  createRateBand(@Body() body: CreateRateBandDto, @CurrentUser('id') actorId: string) {
    return this.admin.createRateBand(body, actorId);
  }
  @Get('audit-logs')
  auditLogs(@Query() query: AuditLogQuery) { return this.admin.auditLogs(query); }
  @Get('roles')
  roles() { return this.admin.roles(); }
  @Get('sla-overview')
  slaOverview() { return this.admin.slaOverview(); }
}
