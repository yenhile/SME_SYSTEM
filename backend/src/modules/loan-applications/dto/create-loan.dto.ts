import { IsNotEmpty, IsString, IsNumber, IsEnum, Min, IsOptional } from 'class-validator';
import { LoanType } from '@prisma/client';

export class CreateLoanDto {
  // Thông tin Doanh nghiệp
  @IsNotEmpty({ message: 'Mã số thuế không được để trống' })
  @IsString()
  taxCode: string;

  @IsNotEmpty({ message: 'Tên doanh nghiệp không được để trống' })
  @IsString()
  companyName: string;

  @IsNotEmpty({ message: 'Ngành nghề không được để trống' })
  @IsString()
  industry: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1950)
  establishedYear: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  annualRevenue: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  charterCapital: number;

  @IsNotEmpty()
  @IsString()
  representativeName: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  // Thông tin Khoản vay
  @IsNotEmpty({ message: 'Mục đích vay không được để trống' })
  @IsString()
  loanPurpose: string;

  @IsNotEmpty({ message: 'Loại vay không được để trống' })
  @IsEnum(LoanType, { message: 'Loại vay không hợp lệ' })
  loanType: LoanType;

  @IsNotEmpty({ message: 'Số tiền đề xuất vay không được để trống' })
  @IsNumber()
  @Min(10000000, { message: 'Số tiền vay tối thiểu 10 triệu VNĐ' })
  proposedAmount: number;

  @IsNotEmpty({ message: 'Thời hạn vay không được để trống' })
  @IsNumber()
  @Min(1, { message: 'Thời hạn vay tối thiểu 1 tháng' })
  loanTermMonths: number;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
