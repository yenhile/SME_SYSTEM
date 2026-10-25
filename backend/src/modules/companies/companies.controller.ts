import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN, RoleCode.QUAN_LY)
@Controller('companies')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get('check/:taxCode')
  checkTaxCode(@Param('taxCode') taxCode: string, @CurrentUser() user: any) {
    return this.companiesService.checkTaxCode(taxCode, user);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('keyword') keyword?: string) {
    return this.companiesService.findAll(user, keyword);
  }

  @Post()
  @Roles(RoleCode.CBTD)
  upsert(@Body() body: any, @CurrentUser() user: any) {
    return this.companiesService.upsert(body, user);
  }
}
