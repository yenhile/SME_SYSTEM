import { Controller, Post, Put, Get, Param, Body, UseGuards } from '@nestjs/common';
import { SupplementsService } from './supplements.service';
import { CreateSupplementDto } from './dto/create-supplement.dto';
import { ResolveSupplementDto } from './dto/resolve-supplement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('supplements')
export class SupplementsController {
  constructor(private readonly supplementsService: SupplementsService) {}

  @Get('application/:applicationId')
  getSupplements(@Param('applicationId') applicationId: string) {
    return this.supplementsService.getSupplements(applicationId);
  }

  @Post(':applicationId')
  createRequest(
    @Param('applicationId') applicationId: string,
    @Body() dto: CreateSupplementDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.supplementsService.createSupplementRequest(applicationId, dto, userId);
  }

  @Put(':supplementId/resolve')
  resolveRequest(
    @Param('supplementId') supplementId: string,
    @Body() dto: ResolveSupplementDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.supplementsService.resolveSupplementRequest(supplementId, dto, userId);
  }
}
