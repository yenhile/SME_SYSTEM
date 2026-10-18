import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { PredictionService } from './prediction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LoanAccessGuard } from '../../common/guards/loan-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
@Controller('prediction')
@UseGuards(JwtAuthGuard, RolesGuard, LoanAccessGuard)
@Roles(RoleCode.THAM_QUYEN, RoleCode.QUAN_LY)
export class PredictionController {
  constructor(private readonly prediction: PredictionService) {}
  @Post('predict/:applicationId')
  predict(@Param('applicationId') id: string) { return this.prediction.predictForApplication(id); }
}
