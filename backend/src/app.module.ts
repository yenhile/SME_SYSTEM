import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from './prisma.service';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { LoanApplicationsModule } from './modules/loan-applications/loan-applications.module';
import { PredictionModule } from './modules/prediction/prediction.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { SupplementsModule } from './modules/supplements/supplements.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    CompaniesModule,
    LoanApplicationsModule,
    PredictionModule,
    WorkflowModule,
    SupplementsModule,
    AssignmentsModule,
    DocumentsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [HealthService, PrismaService],
})
export class AppModule {}
