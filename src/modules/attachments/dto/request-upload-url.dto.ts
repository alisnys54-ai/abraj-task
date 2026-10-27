import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength } from 'class-validator';

export class RequestUploadUrlDto {
  @ApiProperty() @IsString() @MaxLength(200) file_name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mime_type?: string;
  @ApiProperty() @IsInt() @Max(50 * 1024 * 1024) file_size_bytes: number;
}
