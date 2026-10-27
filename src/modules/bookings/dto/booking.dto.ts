import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const BOOKING_STATUSES = ['pending_deposit', 'confirmed', 'cancelled'] as const;

export class NewClientDto {
  @ApiProperty() @IsString() @MaxLength(160) full_name: string;
  @ApiProperty({ example: '07801234567' }) @Matches(/^07\d{9}$/, { message: 'phone must be an Iraqi mobile number like 07801234567' }) phone: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) national_id?: string;
}

export class InstallmentPlanDto {
  @ApiProperty({ example: 24 }) @Type(() => Number) @IsInt() @Min(1) @Max(120) count: number;
  @ApiProperty({ example: '2026-12-01' }) @IsDateString() first_due_date: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) interval_months?: number;
}

export class CreateBookingDto {
  @ApiProperty() @IsUUID() unit_id: string;
  @ApiPropertyOptional({ description: 'Existing client — or send `client` to create one (matched by phone)' }) @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional({ type: NewClientDto }) @IsOptional() @ValidateNested() @Type(() => NewClientDto) client?: NewClientDto;
  @ApiPropertyOptional({ description: 'Defaults to the unit type price' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) price?: number;
  @ApiPropertyOptional({ description: '> 0 confirms the booking immediately' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) deposit_amount?: number;
  @ApiPropertyOptional({ description: 'Defaults to you; another rep needs company/department scope' }) @IsOptional() @IsUUID() sales_rep_id?: string;
  @ApiPropertyOptional({ type: InstallmentPlanDto }) @IsOptional() @ValidateNested() @Type(() => InstallmentPlanDto) installment_plan?: InstallmentPlanDto;
}

export class ConfirmBookingDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) deposit_amount: number;
}

export class CancelBookingDto {
  @ApiProperty() @IsString() @MaxLength(300) reason: string;
}

export class QueryBookingsDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) site_code?: string;
  @ApiPropertyOptional({ enum: BOOKING_STATUSES }) @IsOptional() @IsIn(BOOKING_STATUSES) status?: (typeof BOOKING_STATUSES)[number];
}

export class QueryInstallmentsDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) site_code?: string;
  @ApiPropertyOptional({ enum: ['due', 'overdue', 'paid'] }) @IsOptional() @IsIn(['due', 'overdue', 'paid']) status?: 'due' | 'overdue' | 'paid';
  @ApiPropertyOptional() @IsOptional() @IsUUID() booking_id?: string;
}

export class PayInstallmentDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) amount: number;
  @ApiProperty() @IsString() @MaxLength(40) receipt_no: string;
  @ApiPropertyOptional({ description: 'Defaults to today' }) @IsOptional() @IsDateString() paid_at?: string;
}
