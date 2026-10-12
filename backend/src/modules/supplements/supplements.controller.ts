import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { LoanAccessGuard } from '../../common/guards/loan-access.guard';
import { Controller, Post, Put, Get, Param, Body, UseGuards } from '@nestjs/common';
import { SupplementsService } from './supplements.service';
import { CreateSupplementDto } from './dto/create-supplement.dto';
import { ResolveSupplementDto } from './dto/resolve-supplement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard, LoanAccessGuard)
@Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN, RoleCode.QUAN_LY)
@Controller('supplements')
export class SupplementsController {
  constructor(private readonly supplementsService: SupplementsService) {}

  @Get('application/:applicationId')
  getSupplements(@Param('applicationId') applicationId: string) {
    return this.supplementsService.getSupplements(applicationId);
  }

  @Post(':applicationId')
  @Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN)
  createRequest(
    @Param('applicationId') applicationId: string,
    @Body() dto: CreateSupplementDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.supplementsService.createSupplementRequest(applicationId, dto, userId);
  }

  @Put(':supplementId/resolve')
  @Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN)
  resolveRequest(
    @Param('supplementId') supplementId: string,
    @Body() dto: ResolveSupplementDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.supplementsService.resolveSupplementRequest(supplementId, dto, userId);
  }
}
