import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { WorkflowModule } from '../workflow/workflow.module';
import { PredictionModule } from '../prediction/prediction.module';
import { AppraisalService } from './appraisal.service';
import { AppraisalController } from './appraisal.controller';
@Module({imports:[WorkflowModule,PredictionModule],controllers:[AppraisalController],providers:[PrismaService,AppraisalService]})
export class AppraisalModule {}
