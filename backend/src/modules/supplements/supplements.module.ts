import { Module } from '@nestjs/common';
import { SupplementsService } from './supplements.service';
import { SupplementsController } from './supplements.controller';
import { PrismaService } from '../../prisma.service';
import { PredictionModule } from '../prediction/prediction.module';
import { JwtModule } from '@nestjs/jwt';
import { PortalAuthService, PortalGuard } from '../portal/portal.auth';
import { PortalMailer } from '../portal/portal.mailer';
import { PortalSupplementsController } from './portal-supplements.controller';
import { PortalSupplementsService } from './portal-supplements.service';
import { SupplementRemindersService } from './supplement-reminders.service';

@Module({
  imports: [PredictionModule, JwtModule.register({})],
  controllers: [SupplementsController,PortalSupplementsController],
  providers: [SupplementsService, PrismaService,PortalSupplementsService,PortalAuthService,PortalGuard,PortalMailer,SupplementRemindersService],
  exports: [SupplementsService],
})
export class SupplementsModule {}
