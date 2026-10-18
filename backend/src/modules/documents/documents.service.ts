import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join, basename } from 'node:path';

@Injectable()
export class DocumentsService {
  private readonly uploadDir = join(process.cwd(), 'uploads');
  constructor(private prisma: PrismaService) {}

  async upload(applicationId: string, documentType: DocumentType, file: { buffer: Buffer; originalname: string; size: number; mimetype: string }, userId: string) {
    await mkdir(this.uploadDir, { recursive: true });
    const key = randomUUID();
    const path = join(this.uploadDir, key);
    await writeFile(path, file.buffer);
    try {
      return await this.create(applicationId, { documentType, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype, filePath: key }, userId);
    } catch (err) { await unlink(path); throw err; }
  }
  async download(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Không tìm thấy chứng từ.');
    // Seed metadata may reference files that were never uploaded.
    if (basename(document.filePath) !== document.filePath) throw new NotFoundException('Tệp chưa được tải lên hệ thống.');
    try { return { buffer: await readFile(join(this.uploadDir, document.filePath)), fileName: document.fileName }; }
    catch { throw new NotFoundException('Không tìm thấy tệp đã lưu.'); }
  }

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

    const deleted = await this.prisma.document.delete({
      where: { id },
    });
    if (basename(doc.filePath) === doc.filePath) await unlink(join(this.uploadDir, doc.filePath)).catch(() => undefined);
    return deleted;
  }
}
