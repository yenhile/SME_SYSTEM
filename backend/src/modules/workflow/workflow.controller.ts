import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { LoanAccessGuard } from '../../common/guards/loan-access.guard';
import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { CloseOverdueDto } from './dto/close-overdue.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard, LoanAccessGuard)
@Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN, RoleCode.QUAN_LY)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('stages')
  getWorkflowStages() {
    return this.workflowService.getWorkflowStages();
  }

  @Get(':id/history')
  getWorkflowHistory(@Param('id') id: string) {
    return this.workflowService.getWorkflowHistory(id);
  }

  @Post(':id/transition')
  @Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN)
  transitionStage(
    @Param('id') id: string,
    @Body() dto: TransitionStageDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowService.transitionStage(id, dto, user);
  }

  // DEC-02: chỉ Quản lý đóng thủ công hồ sơ quá hạn bổ sung; không có đóng tự động.
  @Post(':id/close-overdue')
  @Roles(RoleCode.QUAN_LY)
  closeOverdueSupplement(
    @Param('id') id: string,
    @Body() dto: CloseOverdueDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowService.closeOverdueSupplement(id, dto, user);
  }
}
