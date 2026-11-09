import { Module } from '@nestjs/common';
import { LoanApplicationsService } from './loan-applications.service';
import { LoanApplicationsController } from './loan-applications.controller';
import { PrismaService } from '../../prisma.service';
import { PredictionModule } from '../prediction/prediction.module';

@Module({
  imports: [PredictionModule],
  controllers: [LoanApplicationsController],
  providers: [LoanApplicationsService, PrismaService],
  exports: [LoanApplicationsService],
})
export class LoanApplicationsModule {}
