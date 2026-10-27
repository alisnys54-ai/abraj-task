import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty() @IsString() @MaxLength(160) title: string;
  @ApiProperty() @IsString() @MaxLength(5000) body: string;
  @ApiPropertyOptional({ example: 'إداري' }) @IsOptional() @IsString() @MaxLength(40) category?: string;
  @ApiPropertyOptional({ enum: ['all', 'department'], default: 'all' }) @IsOptional() @IsIn(['all', 'department']) audience?: 'all' | 'department';
  @ApiPropertyOptional({ description: 'Required when audience is department (defaults to yours)' }) @IsOptional() @IsUUID() department_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pinned?: boolean;
}
