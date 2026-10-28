import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'on_leave'] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class QueryAttendanceDto extends PaginationQueryDto {
  @ApiProperty({ example: '2026-10-27' }) @IsDateString() date: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() department_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() site_id?: string;
}

export class AttendanceSummaryQueryDto {
  @ApiProperty({ example: '2026-10-27' }) @IsDateString() date: string;
}

export class AttendanceEntryDto {
  @ApiProperty() @IsUUID() employee_id: string;
  @ApiProperty({ enum: ATTENDANCE_STATUSES }) @IsIn(ATTENDANCE_STATUSES) status: (typeof ATTENDANCE_STATUSES)[number];
  @ApiPropertyOptional({ example: '06:55' }) @IsOptional() @Matches(HHMM) check_in?: string;
  @ApiPropertyOptional({ example: '15:10' }) @IsOptional() @Matches(HHMM) check_out?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class RecordAttendanceDto {
  @ApiProperty({ example: '2026-10-27' }) @IsDateString() date: string;
  @ApiProperty({ type: [AttendanceEntryDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => AttendanceEntryDto)
  records: AttendanceEntryDto[];
}
