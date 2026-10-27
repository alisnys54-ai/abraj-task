import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const UNIT_STATUSES = ['available', 'reserved', 'sold', 'under_construction'] as const;

export class QueryUnitsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Site code, e.g. qdiw' }) @IsOptional() @IsString() @MaxLength(30) site_code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) block?: string;
  @ApiPropertyOptional({ description: 'Unit type code, e.g. A' }) @IsOptional() @IsString() @MaxLength(10) type_code?: string;
  @ApiPropertyOptional({ enum: UNIT_STATUSES }) @IsOptional() @IsIn(UNIT_STATUSES) status?: (typeof UNIT_STATUSES)[number];
}

export class UpdateUnitStatusDto {
  @ApiProperty({ enum: ['available', 'under_construction'], description: 'Reserved/sold are set only by bookings' })
  @IsIn(['available', 'under_construction'])
  status: 'available' | 'under_construction';
}
