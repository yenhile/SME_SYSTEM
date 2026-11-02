import { Body, Controller, Get, HttpStatus, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LoanAccessGuard } from '../../common/guards/loan-access.guard';
import { LoanActor } from '../workflow/loan-policy';
import { AppraisalService } from './appraisal.service';
@Controller('appraisals')
@UseGuards(JwtAuthGuard,RolesGuard,LoanAccessGuard)
@Roles(RoleCode.CBTD,RoleCode.THAM_QUYEN,RoleCode.QUAN_LY)
export class AppraisalController {
  constructor(private service:AppraisalService) {}
  @Get(':applicationId')
  async view(
    @Param('applicationId') id: string,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: any,
  ) {
    const report = await this.service.view(id, user);
    if (!report) {
      if (res?.status) res.status(HttpStatus.NO_CONTENT);
      return;
    }
    return report;
  }
  @Put(':applicationId/draft') @Roles(RoleCode.CBTD)
  save(@Param('applicationId') id:string,@Body() body:any,@CurrentUser() user:LoanActor) {return this.service.mutate(id,'DRAFT_SAVED',body,user);}
  @Post(':applicationId/submit') @Roles(RoleCode.CBTD)
  submit(@Param('applicationId') id:string,@Body() body:any,@CurrentUser() user:LoanActor) {return this.service.mutate(id,'SUBMITTED',body,user);}
  @Post(':applicationId/clarify') @Roles(RoleCode.THAM_QUYEN)
  clarify(@Param('applicationId') id:string,@Body() body:any,@CurrentUser() user:LoanActor) {return this.service.mutate(id,'CLARIFICATION_REQUESTED',body,user);}
}
