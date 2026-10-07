import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReassignOfficerDto {
  @IsNotEmpty({ message: 'Vui lòng chọn cán bộ tín dụng tiếp nhận mới' })
  @IsString()
  newOfficerId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
