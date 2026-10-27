import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() department_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() priority_id?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() reviewer_id?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() start_date?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString() due_date?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() reminder_date?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
