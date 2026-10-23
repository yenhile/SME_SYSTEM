import { Controller, Get, Post, Param, Body, Req, UseGuards, UseInterceptors, UploadedFile, StreamableFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PortalGuard } from '../portal/portal.auth';
import { PortalFile } from '../portal/portal.validation';
import { PortalSupplementsService } from './portal-supplements.service';

export const supplementDownload=(result:{buffer:Buffer;fileName:string})=>new StreamableFile(result.buffer,{type:'application/octet-stream',disposition:`attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`});
@Controller('portal/requests/:requestId/supplements')
@UseGuards(PortalGuard)
export class PortalSupplementsController {
  constructor(private service:PortalSupplementsService) {}
  @Get() list(@Param('requestId') requestId:string,@Req() req:any) {return this.service.list(requestId,req.portalAccount.id);}
  @Post(':supplementId/respond') respond(@Param('requestId') requestId:string,@Param('supplementId') id:string,@Req() req:any,@Body() body:any) {return this.service.respond(requestId,req.portalAccount.id,id,body);}
  @Post(':supplementId/items/:itemId/files')
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1,fields:3,fieldSize:16*1024}}))
  upload(@Param('requestId') requestId:string,@Param('supplementId') id:string,@Param('itemId') itemId:string,@Req() req:any,@Body() body:any,@UploadedFile() file:PortalFile) {return this.service.upload(requestId,req.portalAccount.id,id,itemId,file,body);}
  @Get(':supplementId/files/:fileId/download') async download(@Param('requestId') requestId:string,@Param('supplementId') id:string,@Param('fileId') fileId:string,@Req() req:any) {return supplementDownload(await this.service.download(id,fileId,{requestId,accountId:req.portalAccount.id}));}
}
