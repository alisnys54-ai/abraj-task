import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const EMPLOYEE_STATUSES = ['active', 'on_leave', 'suspended', 'terminated'] as const;

export class CreateEmployeeDto {
  @ApiPropertyOptional({ description: 'Leave empty to auto-number (AY-####)' })
  @IsOptional() @IsString() @Matches(/^[A-Z]{2}-\d{3,6}$/, { message: 'employee_no must look like AY-1048' })
  employee_no?: string;
  @ApiProperty() @IsString() @MaxLength(120) full_name: string;
  @ApiProperty() @IsUUID() department_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() position_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() site_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) work_location?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^07\d{9}$/, { message: 'phone must be an Iraqi mobile number like 07801234567' }) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) national_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() hire_date?: string;
  @ApiPropertyOptional({ description: 'Monthly base salary in IQD' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) base_salary?: number;
  @ApiPropertyOptional({ description: 'Link to a login account' }) @IsOptional() @IsUUID() user_id?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional({ enum: EMPLOYEE_STATUSES }) @IsOptional() @IsIn(EMPLOYEE_STATUSES) status?: (typeof EMPLOYEE_STATUSES)[number];
}

export class QueryEmployeesDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() department_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() site_id?: string;
  @ApiPropertyOptional({ enum: EMPLOYEE_STATUSES }) @IsOptional() @IsIn(EMPLOYEE_STATUSES) status?: (typeof EMPLOYEE_STATUSES)[number];
}
