import { BadRequestException, Body, Controller, Get, Param, Put, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { IsDivisibleBy, IsInt, IsString, Min, MinLength } from 'class-validator';
import { RoleCode, StageCode } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { Roles } from './common/decorators/roles.decorator';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

export class UpdateSlaDto {
  @IsInt({ message: 'Định mức SLA phải là số giờ nguyên.' })
  @Min(4, { message: 'Định mức SLA tối thiểu là 0,5 ngày làm việc (4 giờ).' })
  @IsDivisibleBy(4, { message: 'Định mức SLA phải theo bước 0,5 ngày làm việc (bội số của 4 giờ).' })
  standardSlaHours: number;
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
    if (code === StageCode.HOAN_TAT) throw new BadRequestException('Công đoạn Hoàn tất không tính SLA nên không có định mức để sửa.');
    return this.prisma.workflowStage.update({ where: { stageCode: code }, data: body });
  }
}
