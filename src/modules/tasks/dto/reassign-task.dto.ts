import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReassignTaskDto {
  @ApiProperty() @IsUUID() assignee_id: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) reason?: string;
}
