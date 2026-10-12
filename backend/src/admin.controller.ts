import { Body, Controller, Get, Param, Put, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { IsInt, IsString, Min, MinLength } from 'class-validator';
import { RoleCode, StageCode } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { Roles } from './common/decorators/roles.decorator';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

export class UpdateSlaDto {
  @IsInt() @Min(1) standardSlaHours: number;
  @IsString() @MinLength(1) stageName: string;
}
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.ADMIN)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('workflow-stages')
  stages() { return this.prisma.workflowStage.findMany({ orderBy: { orderIndex: 'asc' } }); }
  @Put('workflow-stages/:code')
  updateStage(@Param('code', new ParseEnumPipe(StageCode)) code: StageCode, @Body() body: UpdateSlaDto) {
    return this.prisma.workflowStage.update({ where: { stageCode: code }, data: body });
  }
}
