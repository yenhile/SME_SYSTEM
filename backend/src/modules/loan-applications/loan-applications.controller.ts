import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LoanApplicationsService } from './loan-applications.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StageCode, LoanStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('loan-applications')
export class LoanApplicationsController {
  constructor(private loanService: LoanApplicationsService) {}

  @Post()
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
  ) {
    return this.loanService.findAll(user, {
      stage,
      status,
      keyword,
      myOnly: myOnly === 'true',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loanService.findOne(id);
  }

  @Put(':id/check-documents')
  checkDocuments(@Param('id') id: string, @Body('isComplete') isComplete: boolean) {
    return this.loanService.checkDocuments(id, isComplete);
  }

  @Put(':id/set-amount')
  setAmount(@Param('id') id: string, @Body('officialAmount') officialAmount: number) {
    return this.loanService.setOfficialAmount(id, Number(officialAmount));
  }
}
