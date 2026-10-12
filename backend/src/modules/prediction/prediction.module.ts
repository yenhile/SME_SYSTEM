import { Module } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [PredictionController],
  providers: [PredictionService, PrismaService],
  exports: [PredictionService],
})
export class PredictionModule {}
