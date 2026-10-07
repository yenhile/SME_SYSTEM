import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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
  upsert(@Body() body: any) {
    return this.companiesService.upsert(body);
  }
}
