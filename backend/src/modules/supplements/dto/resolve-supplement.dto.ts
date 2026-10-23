import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ResolveSupplementDto {
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;
  @IsOptional()
  @IsString()
  notes?: string;
}
