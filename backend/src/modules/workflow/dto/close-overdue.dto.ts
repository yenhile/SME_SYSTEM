import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseOverdueDto {
  // Bắt buộc có lý do; kiểm tra rỗng nằm ở service để trả lỗi rõ ràng.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
