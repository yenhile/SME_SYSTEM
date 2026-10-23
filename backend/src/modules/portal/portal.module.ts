import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { PortalAuthController, PortalRequestsController, PortalIntakesController } from './portal.controller';
import { PortalAuthService, PortalGuard } from './portal.auth';
import { PortalMailer } from './portal.mailer';
import { PortalService } from './portal.service';

@Module({imports:[AuthModule,JwtModule.register({})],controllers:[PortalAuthController,PortalRequestsController,PortalIntakesController],providers:[PrismaService,PortalAuthService,PortalGuard,PortalMailer,PortalService]})
export class PortalModule {}
