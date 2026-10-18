import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { LoanAccessGuard } from '../../common/guards/loan-access.guard';
import { Controller, Post, Get, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException, StreamableFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { DocumentType } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard, LoanAccessGuard)
@Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN, RoleCode.QUAN_LY)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(':applicationId')
  findByApplication(@Param('applicationId') applicationId: string) {
    return this.documentsService.findByApplication(applicationId);
  }

  @Post(':applicationId')
  @Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  create(
    @Param('applicationId') applicationId: string,
    @Body('documentType') documentType: DocumentType,
    @UploadedFile() file: { buffer: Buffer; originalname: string; size: number; mimetype: string },
    @CurrentUser('id') userId: string,
  ) {
    if (!file || !Object.values(DocumentType).includes(documentType)) throw new BadRequestException('Cần chọn tệp và loại chứng từ hợp lệ.');
    return this.documentsService.upload(applicationId, documentType, file, userId);
  }

  @Delete(':id')
  @Roles(RoleCode.CBTD, RoleCode.THAM_QUYEN)
  delete(@Param('id') id: string) {
    return this.documentsService.delete(id);
  }

  @Get(':id/download')
  async download(@Param('id') id: string) {
    const result = await this.documentsService.download(id);
    return new StreamableFile(result.buffer, { type: 'application/octet-stream', disposition: `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}` });
  }
}
