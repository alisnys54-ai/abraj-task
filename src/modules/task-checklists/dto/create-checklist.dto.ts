import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChecklistDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) title?: string;
}
