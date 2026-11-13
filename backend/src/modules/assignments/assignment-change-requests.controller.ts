import {Controller,Get,Post,Param,Query,Body,UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../../common/guards/jwt-auth.guard';
import {RolesGuard} from '../../common/guards/roles.guard';
import {Roles} from '../../common/decorators/roles.decorator';
import {CurrentUser} from '../../common/decorators/current-user.decorator';
import {RoleCode} from '@prisma/client';
import {AssignmentChangeRequestsService} from './assignment-change-requests.service';
import {LoanActor} from '../workflow/loan-policy';
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(RoleCode.CBTD,RoleCode.QUAN_LY,RoleCode.ADMIN)
@Controller('assignment-change-requests')
export class AssignmentChangeRequestsController{
  constructor(private service:AssignmentChangeRequestsService){}
  @Get('capabilities') capabilities(@Query() query:any,@CurrentUser() actor:LoanActor){return this.service.capabilities(query,actor);}
  @Get() list(@Query() query:any,@CurrentUser() actor:LoanActor){return this.service.list(query,actor);}
  @Get(':id') detail(@Param('id') id:string,@CurrentUser() actor:LoanActor){return this.service.detail(id,actor);}
  @Post() @Roles(RoleCode.CBTD) create(@Body() body:any,@CurrentUser() actor:LoanActor){return this.service.create(body,actor);}
  @Post(':id/approve') @Roles(RoleCode.QUAN_LY) approve(@Param('id') id:string,@Body() body:any,@CurrentUser() actor:LoanActor){return this.service.resolve(id,'approve',body,actor);}
  @Post(':id/reject') @Roles(RoleCode.QUAN_LY) reject(@Param('id') id:string,@Body() body:any,@CurrentUser() actor:LoanActor){return this.service.resolve(id,'reject',body,actor);}
  @Post(':id/cancel') @Roles(RoleCode.CBTD) cancel(@Param('id') id:string,@Body() body:any,@CurrentUser() actor:LoanActor){return this.service.resolve(id,'cancel',body,actor);}
}
