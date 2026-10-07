import { IsOptional, IsString } from 'class-validator';

export class ResolveSupplementDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
