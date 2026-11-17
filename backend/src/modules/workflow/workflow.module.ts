import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { PrismaService } from '../../prisma.service';
import { PredictionModule } from '../prediction/prediction.module';
import { PortalMailer } from '../portal/portal.mailer';

@Module({
  imports: [PredictionModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, PrismaService, PortalMailer],
  exports: [WorkflowService],
})
export class WorkflowModule {}
