import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateChecklistItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) text?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_done?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sort_order?: number;
}
