import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards, UseInterceptors, UploadedFile, StreamableFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PortalAuthService, PortalGuard } from './portal.auth';
import { PortalService } from './portal.service';
import type { PortalFile } from './portal.validation';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';

const downloadResponse = (result:{buffer:Buffer,fileName:string}) => new StreamableFile(result.buffer,{type:'application/octet-stream',disposition:`attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`});
@Controller('portal/auth')
export class PortalAuthController {
  constructor(private auth:PortalAuthService) {}
  @Post('register') register(@Body() body:any,@Req() req:any) {return this.auth.register(body,req.ip);}
  @Post('verify-email') verify(@Body() body:any,@Req() req:any) {return this.auth.verify(body,req.ip);}
  @Post('resend-verification') resend(@Body() body:any,@Req() req:any) {return this.auth.resend(body,req.ip);}
  @Post('login') login(@Body() body:any,@Req() req:any) {return this.auth.login(body,req.ip);}
  @Get('me') @UseGuards(PortalGuard) me(@Req() req:any) {return req.portalAccount;}
}
@Controller('portal/requests')
@UseGuards(PortalGuard)
export class PortalRequestsController {
  constructor(private service:PortalService) {}
  @Get() list(@Req() req:any) {return this.service.list(req.portalAccount.id);}
  @Get('form-config') config() {return this.service.formConfig();}
  @Post() create(@Req() req:any,@Body() body:any) {return this.service.create(req.portalAccount.id,body);}
  @Get(':id') one(@Req() req:any,@Param('id') id:string) {return this.service.one(id,req.portalAccount.id);}
  @Put(':id') update(@Req() req:any,@Param('id') id:string,@Body() body:any) {return this.service.update(id,req.portalAccount.id,body);}
  @Get(':id/checklist') checklist(@Req() req:any,@Param('id') id:string) {return this.service.checklist(id,req.portalAccount.id);}
  @Get(':id/readiness') readiness(@Req() req:any,@Param('id') id:string) {return this.service.readiness(id,req.portalAccount.id);}
  @Get(':id/documents') documentHeads(@Req() req:any,@Param('id') id:string) {return this.service.documentHeads(id,req.portalAccount.id);}
  private uploadOptions(body:any) {
    if(!body || Object.keys(body).some(k=>!['documentGroup','coverage','clientUploadId','expectedRevision'].includes(k))) throw new BadRequestException('Metadata tải tệp không hợp lệ.');
    const options:any={};
    if(body.coverage!==undefined) {try {options.coverage=JSON.parse(body.coverage);} catch {throw new BadRequestException('coverage phải là JSON hợp lệ.');}}
    if(body.clientUploadId!==undefined) options.clientUploadId=body.clientUploadId;
    if(body.expectedRevision!==undefined) {
      if(typeof body.expectedRevision!=='string' || !/^(0|[1-9]\d*)$/.test(body.expectedRevision)) throw new BadRequestException('expectedRevision không hợp lệ.');
      options.expectedRevision=Number(body.expectedRevision);
    }
    return options;
  }
  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1,fields:4,fieldSize:16*1024}}))
  upload(@Req() req:any,@Param('id') id:string,@Body() body:any,@UploadedFile() file:PortalFile) {return this.service.upload(id,req.portalAccount.id,body.documentGroup,file,this.uploadOptions(body));}
  @Post(':id/documents/:documentId/replace')
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1,fields:4,fieldSize:16*1024}}))
  replace(@Req() req:any,@Param('id') id:string,@Param('documentId') documentId:string,@Body() body:any,@UploadedFile() file:PortalFile) {return this.service.upload(id,req.portalAccount.id,body.documentGroup,file,this.uploadOptions(body),documentId);}
  @Get(':id/documents/:documentId/versions') versions(@Req() req:any,@Param('id') id:string,@Param('documentId') documentId:string) {return this.service.documentVersions(id,req.portalAccount.id,documentId);}
  @Delete(':id/documents/:documentId') delete(@Req() req:any,@Param('id') id:string,@Param('documentId') documentId:string,@Body() body:any) {
    if(body && (typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>k!=='expectedRevision'))) throw new BadRequestException('Thông tin xóa tệp không hợp lệ.');
    return this.service.deleteDocument(id,req.portalAccount.id,documentId,body?.expectedRevision);
  }
  @Get(':id/documents/:documentId/download') async download(@Req() req:any,@Param('id') id:string,@Param('documentId') documentId:string) {return downloadResponse(await this.service.download(id,documentId,req.portalAccount.id));}
  @Post(':id/submit') submit(@Req() req:any,@Param('id') id:string,@Body() body:any) {return this.service.submit(id,req.portalAccount.id,body);}
}
@Controller('portal-intakes')
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(RoleCode.CBTD,RoleCode.THAM_QUYEN,RoleCode.QUAN_LY)
export class PortalIntakesController {
  constructor(private service:PortalService) {}
  @Get() list(@Req() req:any) {return this.service.list(undefined,req.user);}
  @Get('officers') @Roles(RoleCode.QUAN_LY)
  officers() {return this.service.officers();}
  @Get('form-config') config() {return this.service.formConfig();}
  @Post(':id/assign') @Roles(RoleCode.QUAN_LY)
  assign(@Req() req:any,@Param('id') id:string,@Body() body:any) {return this.service.assign(id,body,req.user.id);}
  @Get(':id/assignment-history')
  history(@Req() req:any,@Param('id') id:string) {return this.service.assignmentHistory(id,req.user);}
  @Get(':id') one(@Req() req:any,@Param('id') id:string) {return this.service.one(id,undefined,req.user);}
  @Get(':id/company-match') match(@Req() req:any,@Param('id') id:string) {return this.service.companyMatch(id,req.user);}
  @Get(':id/documents/:documentId/download') async download(@Req() req:any,@Param('id') id:string,@Param('documentId') documentId:string) {return downloadResponse(await this.service.download(id,documentId,undefined,req.user));}
  @Post(':id/accept') @Roles(RoleCode.CBTD)
  accept(@Req() req:any,@Param('id') id:string,@Body() body:any) {
    if(body && (Object.keys(body).some(k=>!['confirmExistingCompany','confirmExistingCompanyFinancials'].includes(k)) || ['confirmExistingCompany','confirmExistingCompanyFinancials'].some(k=>body[k]!==undefined&&typeof body[k]!=='boolean'))) throw new BadRequestException('Thông tin xác nhận không hợp lệ.');
    return this.service.accept(id,req.user.id,body?.confirmExistingCompany===true,body?.confirmExistingCompanyFinancials===true);
  }
}
