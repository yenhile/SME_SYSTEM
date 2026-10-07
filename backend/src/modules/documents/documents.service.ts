import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo bản ghi chứng từ đính kèm (UC05)
   */
  async create(applicationId: string, dto: CreateDocumentDto, userId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: applicationId },
    });

    if (!loan) {
      throw new NotFoundException(`Không tìm thấy hồ sơ với ID: ${applicationId}`);
    }

    return this.prisma.document.create({
      data: {
        applicationId,
        documentType: dto.documentType,
        fileName: dto.fileName,
        filePath: dto.filePath,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        uploadedBy: userId,
      },
      include: {
        uploader: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });
  }

  /**
   * Lấy danh sách tài liệu đính kèm theo hồ sơ
   */
  async findByApplication(applicationId: string) {
    return this.prisma.document.findMany({
      where: { applicationId },
      include: {
        uploader: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Xóa chứng từ
   */
  async delete(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new NotFoundException(`Không tìm thấy chứng từ với ID: ${id}`);
    }

    return this.prisma.document.delete({
      where: { id },
    });
  }
}
