import { Module } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { PrismaService } from '../../prisma.service';
import { PredictionModule } from '../prediction/prediction.module';
import {AssignmentChangeRequestsService} from './assignment-change-requests.service';
import {AssignmentChangeRequestsController} from './assignment-change-requests.controller';

@Module({
  imports: [PredictionModule],
  controllers: [AssignmentsController,AssignmentChangeRequestsController],
  providers: [AssignmentsService,AssignmentChangeRequestsService, PrismaService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
