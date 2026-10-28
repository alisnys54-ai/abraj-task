import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DashboardQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() date_from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() date_to?: string;
  @ApiPropertyOptional({ default: 12, description: 'Weeks of history for the completion trend' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(52)
  weeks?: number = 12;
}
