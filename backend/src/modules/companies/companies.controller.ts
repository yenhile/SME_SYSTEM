import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN, RoleCode.QUAN_LY)
@Controller('companies')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get('check/:taxCode')
  checkTaxCode(@Param('taxCode') taxCode: string) {
    return this.companiesService.checkTaxCode(taxCode);
  }

  @Get()
  findAll(@Query('keyword') keyword?: string) {
    return this.companiesService.findAll(keyword);
  }

  @Post()
  @Roles(RoleCode.CBTD)
  upsert(@Body() body: any) {
    return this.companiesService.upsert(body);
  }
}
