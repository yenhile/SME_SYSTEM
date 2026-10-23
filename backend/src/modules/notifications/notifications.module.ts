import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../prisma.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({imports:[AuthModule],controllers:[NotificationsController],providers:[PrismaService,NotificationsService]})
export class NotificationsModule {}
