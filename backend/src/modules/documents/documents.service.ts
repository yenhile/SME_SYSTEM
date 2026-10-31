import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentType, LoanStatus, StageCode } from '@prisma/client';
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
    return this.prisma.$transaction(async tx => {
      // Khóa hồ sơ để thay đổi chứng từ và hủy xác nhận "đủ chứng từ" diễn ra cùng lúc, không xen kẽ với chuyển bước.
      await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${applicationId} FOR UPDATE`;
      const loan = await tx.loanApplication.findUnique({
        where: { id: applicationId },
      });

      if (!loan) {
        throw new NotFoundException(`Không tìm thấy hồ sơ với ID: ${applicationId}`);
      }

      const document = await tx.document.create({
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
      await this.withdrawConfirmation(tx, loan);
      return document;
    });
  }

  /**
   * Chứng từ đã đổi thì xác nhận "đủ chứng từ" không còn đúng: hủy xác nhận để CBTD xác nhận lại trước khi chuyển thẩm định.
   * Chỉ áp dụng ở công đoạn Tiếp nhận (nơi cờ này quyết định việc chuyển bước); công đoạn sau không đụng tới trạng thái hồ sơ.
   */
  private async withdrawConfirmation(
    tx: { loanApplication: { update(args: any): Promise<unknown> } },
    loan: { id: string; currentStage: StageCode; currentStatus: LoanStatus; isDocumentComplete: boolean },
  ) {
    if (loan.currentStage !== StageCode.TIEP_NHAN || !loan.isDocumentComplete) return;
    await tx.loanApplication.update({
      where: { id: loan.id },
      data: {
        isDocumentComplete: false,
        ...(loan.currentStatus === LoanStatus.CHECKED ? { currentStatus: LoanStatus.RECEIVED } : {}),
        updatedAt: new Date(),
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

    const deleted = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${doc.applicationId} FOR UPDATE`;
      if (!(await tx.document.findUnique({ where: { id } }))) throw new NotFoundException(`Không tìm thấy chứng từ với ID: ${id}`);
      const loan = await tx.loanApplication.findUnique({ where: { id: doc.applicationId } });
      const removed = await tx.document.delete({ where: { id } });
      if (loan) await this.withdrawConfirmation(tx, loan);
      return removed;
    });
    if (!doc.portalDocumentId && basename(doc.filePath) === doc.filePath) await unlink(join(this.uploadDir, doc.filePath)).catch(() => undefined);
    return deleted;
  }
}
