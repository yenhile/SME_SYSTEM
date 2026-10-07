import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
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
  transitionStage(
    @Param('id') id: string,
    @Body() dto: TransitionStageDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.workflowService.transitionStage(id, dto, userId);
  }
}
