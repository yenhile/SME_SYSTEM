import { ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { RoleCode } from '@prisma/client';

export class CreateUserDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @MinLength(8) password: string;
  @IsString() @IsNotEmpty() fullName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() branchName?: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsEnum(RoleCode, { each: true }) roles: RoleCode[];
}
export class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() branchName?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsEnum(RoleCode, { each: true }) roles?: RoleCode[];
}
