import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSupplementDto {
  @IsNotEmpty({ message: 'Nội dung yêu cầu bổ sung không được để trống' })
  @IsString()
  requestContent: string;

  @IsOptional()
  deadlineAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
