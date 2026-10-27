import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreatePeriodDto {
  @ApiProperty({ example: 2026 }) @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year: number;
  @ApiProperty({ example: 10 }) @Type(() => Number) @IsInt() @Min(1) @Max(12) month: number;
}

export class UpdateEntryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) allowances?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) deductions?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) advances?: number;
}

export class QueryEntriesDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() department_id?: string;
}
