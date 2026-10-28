import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ChangeStatusDto {
  @ApiProperty() @IsUUID() to_status_id: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) reason?: string;
}
