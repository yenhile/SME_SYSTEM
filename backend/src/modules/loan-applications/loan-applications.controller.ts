import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { LoanAccessGuard } from '../../common/guards/loan-access.guard';
import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LoanApplicationsService } from './loan-applications.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StageCode, LoanStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard, LoanAccessGuard)
@Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN, RoleCode.QUAN_LY)
@Controller('loan-applications')
export class LoanApplicationsController {
  constructor(private loanService: LoanApplicationsService) {}

  @Post()
  @Roles(RoleCode.CBTD)
  create(@Body() dto: CreateLoanDto, @CurrentUser('id') userId: string) {
    return this.loanService.create(dto, userId);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('stage') stage?: StageCode,
    @Query('status') status?: LoanStatus,
    @Query('keyword') keyword?: string,
    @Query('myOnly') myOnly?: string,
    @Query('code') code?: string,
    @Query('company') company?: string,
    @Query('loanType') loanType?: string,
    @Query('officer') officer?: string,
    @Query('overdueOnly') overdueOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('queue') queue?: string,
    @Query('sort') sort?: string,
  ) {
    return this.loanService.findAll(user, {
      stage,
      status,
      keyword,
      myOnly: myOnly === 'true',
      code,
      company,
      loanType,
      officer,
      overdueOnly,
      page,
      pageSize,
      queue,
      sort,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string,@CurrentUser() user:any) {
    return this.loanService.findOne(id,new Date(),user);
  }

  @Put(':id/check-documents')
  @Roles(RoleCode.CBTD)
  checkDocuments(@Param('id') id: string, @Body('isComplete') isComplete: boolean, @CurrentUser() user: any) {
    return this.loanService.checkDocuments(id, isComplete, user);
  }

  @Put(':id/set-amount')
  @Roles(RoleCode.CBTD)
  setAmount(@Param('id') id: string, @Body('officialAmount') officialAmount: number, @CurrentUser() user: any) {
    return this.loanService.setOfficialAmount(id, Number(officialAmount), user);
  }
}
