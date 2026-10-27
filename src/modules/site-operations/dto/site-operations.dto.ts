import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateSiteReportDto {
  @ApiProperty({ example: 'rdiw' }) @IsString() @MaxLength(30) site_code: string;
  @ApiPropertyOptional({ description: 'Defaults to today' }) @IsOptional() @IsDateString() report_date?: string;
  @ApiProperty() @IsString() @MaxLength(4000) summary: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(5000) workers: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(5000) concrete_m3?: number;
  @ApiPropertyOptional({ enum: ['done', 'in_progress'] }) @IsOptional() @IsIn(['done', 'in_progress']) status?: 'done' | 'in_progress';
}

export class QuerySiteReportsDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) site_code?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'closed'] as const;

export class CreateTicketDto {
  @ApiProperty() @IsString() @MaxLength(30) site_code: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unit_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiProperty() @IsString() @MaxLength(160) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional({ enum: TICKET_PRIORITIES }) @IsOptional() @IsIn(TICKET_PRIORITIES) priority?: (typeof TICKET_PRIORITIES)[number];
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TICKET_STATUSES }) @IsOptional() @IsIn(TICKET_STATUSES) status?: (typeof TICKET_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignee_id?: string;
  @ApiPropertyOptional({ enum: TICKET_PRIORITIES }) @IsOptional() @IsIn(TICKET_PRIORITIES) priority?: (typeof TICKET_PRIORITIES)[number];
}

export class QueryTicketsDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) site_code?: string;
  @ApiPropertyOptional({ enum: TICKET_STATUSES }) @IsOptional() @IsIn(TICKET_STATUSES) status?: (typeof TICKET_STATUSES)[number];
  @ApiPropertyOptional({ enum: TICKET_PRIORITIES }) @IsOptional() @IsIn(TICKET_PRIORITIES) priority?: (typeof TICKET_PRIORITIES)[number];
}
