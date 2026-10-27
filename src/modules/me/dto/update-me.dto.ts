import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional({ description: 'Free-form notification channel toggles — shape owned by the frontend' })
  @IsOptional()
  @IsObject()
  notification_prefs?: Record<string, unknown>;
}
