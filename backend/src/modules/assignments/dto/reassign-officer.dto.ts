import { IsNotEmpty, IsString, IsInt, Min, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ReassignOfficerDto {
  @IsNotEmpty({ message: 'Vui lòng chọn cán bộ tín dụng tiếp nhận mới' })
  @IsString()
  newOfficerId: string;

  @Transform(({value})=>typeof value==='string'?value.trim():value)
  @IsNotEmpty({message:'Vui lòng nhập lý do điều chuyển.'})
  @IsString()
  @MaxLength(2000)
  reason: string;

  @IsInt()
  @Min(0)
  expectedAssignmentVersion: number;

  @IsUUID('4')
  clientRequestId: string;
}
