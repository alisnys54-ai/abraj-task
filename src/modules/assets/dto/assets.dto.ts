import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const EQUIPMENT_STATUSES = ['operational', 'maintenance', 'out_of_service'] as const;

export class CreatePlantDto {
  @ApiProperty() @IsString() @MaxLength(120) name: string;
  @ApiProperty() @IsString() @MaxLength(120) location: string;
  @ApiProperty({ example: 'خرسانة جاهزة' }) @IsString() @MaxLength(40) kind: string;
  @ApiPropertyOptional({ example: '120 م³/ساعة' }) @IsOptional() @IsString() @MaxLength(60) capacity?: string;
}

export class CreateEquipmentDto {
  @ApiProperty({ example: 'MX-07' }) @IsString() @MaxLength(30) code: string;
  @ApiProperty({ example: 'خباطة' }) @IsString() @MaxLength(40) category: string;
  @ApiProperty({ example: 'Mercedes Actros 3335' }) @IsString() @MaxLength(80) model: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() plant_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() site_id?: string;
  @ApiPropertyOptional({ enum: EQUIPMENT_STATUSES }) @IsOptional() @IsIn(EQUIPMENT_STATUSES) status?: (typeof EQUIPMENT_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class UpdateEquipmentDto {
  @ApiPropertyOptional({ enum: EQUIPMENT_STATUSES }) @IsOptional() @IsIn(EQUIPMENT_STATUSES) status?: (typeof EQUIPMENT_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() plant_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() site_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class QueryEquipmentDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EQUIPMENT_STATUSES }) @IsOptional() @IsIn(EQUIPMENT_STATUSES) status?: (typeof EQUIPMENT_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() plant_id?: string;
}
