import { Module } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { PredictionSchedulerService } from './prediction-scheduler.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [PredictionController],
  providers: [PredictionService, PredictionSchedulerService, PrismaService],
  exports: [PredictionService],
})
export class PredictionModule {}
