import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const LEAVE_TYPES = ['annual', 'sick', 'hourly', 'maternity', 'unpaid'] as const;
export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

export class CreateLeaveDto {
  @ApiPropertyOptional({ description: 'Required when filing for someone else; omitted = yourself' }) @IsOptional() @IsUUID() employee_id?: string;
  @ApiProperty({ enum: LEAVE_TYPES }) @IsIn(LEAVE_TYPES) type: (typeof LEAVE_TYPES)[number];
  @ApiProperty({ example: '2026-11-02' }) @IsDateString() start_date: string;
  @ApiPropertyOptional({ description: 'Days — required for every type except hourly' }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0.5) @Max(60) days?: number;
  @ApiPropertyOptional({ description: 'Hours — required for hourly leave' }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0.5) @Max(8) hours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class DecideLeaveDto {
  @ApiProperty({ enum: ['approved', 'rejected'] }) @IsIn(['approved', 'rejected']) decision: 'approved' | 'rejected';
  @ApiPropertyOptional({ description: 'Required when rejecting' }) @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class QueryLeavesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LEAVE_STATUSES }) @IsOptional() @IsIn(LEAVE_STATUSES) status?: (typeof LEAVE_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() employee_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() department_id?: string;
}
