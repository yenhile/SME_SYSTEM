import { Module } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { PrismaService } from '../../prisma.service';

@Module({
  providers: [PredictionService, PrismaService],
  exports: [PredictionService],
})
export class PredictionModule {}
