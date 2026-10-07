import { Module } from '@nestjs/common';
import { SupplementsService } from './supplements.service';
import { SupplementsController } from './supplements.controller';
import { PrismaService } from '../../prisma.service';
import { PredictionModule } from '../prediction/prediction.module';

@Module({
  imports: [PredictionModule],
  controllers: [SupplementsController],
  providers: [SupplementsService, PrismaService],
  exports: [SupplementsService],
})
export class SupplementsModule {}
