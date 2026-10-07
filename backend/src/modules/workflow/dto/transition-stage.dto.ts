import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { StageCode, LoanStatus } from '@prisma/client';

export class TransitionStageDto {
  @IsNotEmpty({ message: 'Công đoạn đích không được để trống' })
  @IsEnum(StageCode, { message: 'Mã công đoạn không hợp lệ' })
  targetStage: StageCode;

  @IsNotEmpty({ message: 'Trạng thái đích không được để trống' })
  @IsEnum(LoanStatus, { message: 'Trạng thái hồ sơ không hợp lệ' })
  targetStatus: LoanStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  officialAmount?: number;

  @IsOptional()
  @IsNumber()
  approvedAmount?: number;

  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsString()
  rejectionReasonCode?: string;

  @IsOptional()
  @IsString()
  rejectionNote?: string;
}
