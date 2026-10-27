import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePositionDto {
  @ApiProperty() @IsString() @MaxLength(100) title: string;
  @ApiPropertyOptional({ description: 'Omit for a company-wide title not tied to one department' })
  @IsOptional()
  @IsUUID()
  department_id?: string;
}
