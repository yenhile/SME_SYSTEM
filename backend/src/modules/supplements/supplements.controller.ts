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
import { PortalSupplementsService } from './portal-supplements.service';
import { supplementDownload } from './portal-supplements.controller';

@UseGuards(JwtAuthGuard, RolesGuard, LoanAccessGuard)
@Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN, RoleCode.QUAN_LY)
@Controller('supplements')
export class SupplementsController {
  constructor(private readonly supplementsService: SupplementsService, private readonly portalSupplements:PortalSupplementsService) {}

  @Get(':supplementId/portal-details')
  portalDetails(@Param('supplementId') id:string) {return this.portalSupplements.details(id);}

  @Put(':supplementId/items/:itemId/review')
  @Roles(RoleCode.CBTD,RoleCode.THAM_QUYEN)
  review(@Param('supplementId') id:string,@Param('itemId') itemId:string,@Body() body:any,@CurrentUser() user:{id:string;activeRole:string}) {return this.portalSupplements.review(id,itemId,body,user);}

  @Post(':supplementId/return')
  @Roles(RoleCode.CBTD,RoleCode.THAM_QUYEN)
  returnCorrections(@Param('supplementId') id:string,@Body() body:any,@CurrentUser() user:{id:string;activeRole:string}) {return this.portalSupplements.returnCorrections(id,body,user);}

  @Get(':supplementId/files/:fileId/download')
  async download(@Param('supplementId') id:string,@Param('fileId') fileId:string) {return supplementDownload(await this.portalSupplements.download(id,fileId));}

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
    @CurrentUser('activeRole') activeRole:string,
  ) {
    return this.supplementsService.createSupplementRequest(applicationId, dto, userId, activeRole);
  }

  @Put(':supplementId/resolve')
  @Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN)
  resolveRequest(
    @Param('supplementId') supplementId: string,
    @Body() dto: ResolveSupplementDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('activeRole') activeRole:string,
  ) {
    return this.supplementsService.resolveSupplementRequest(supplementId, dto, userId, activeRole);
  }
}
