import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSupplementDto {
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  @IsOptional()
  @IsArray()
  items?: {documentGroup:string;documentTypeCode:string;period?:string;reason:string}[];
  @IsNotEmpty({ message: 'Nội dung yêu cầu bổ sung không được để trống' })
  @IsString()
  requestContent: string;

  @IsOptional()
  deadlineAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
