import { Module } from '@nestjs/common';
import { LoanApplicationsService } from './loan-applications.service';
import { LoanApplicationsController } from './loan-applications.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [LoanApplicationsController],
  providers: [LoanApplicationsService, PrismaService],
  exports: [LoanApplicationsService],
})
export class LoanApplicationsModule {}
