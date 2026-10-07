import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
  @IsNotEmpty({ message: 'Loại tài liệu không được để trống' })
  @IsEnum(DocumentType, { message: 'Loại tài liệu không hợp lệ (PHAP_LY, TAI_CHINH, PHUONG_AN, TSBD, KHAC)' })
  documentType: DocumentType;

  @IsNotEmpty({ message: 'Tên tệp không được để trống' })
  @IsString()
  fileName: string;

  @IsNotEmpty({ message: 'Đường dẫn tệp không được để trống' })
  @IsString()
  filePath: string;

  @IsNotEmpty({ message: 'Kích thước tệp không được để trống' })
  @IsNumber()
  fileSize: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
