import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class Base64UploadDto {
  @ApiProperty() @IsString() @MaxLength(200) file_name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) mime_type?: string;
  @ApiProperty({ description: 'A data URL (data:image/jpeg;base64,...) or bare base64 — at most 25 MB decoded' })
  @IsString() @MaxLength(36 * 1024 * 1024)
  data_base64: string;
  @ApiPropertyOptional({ enum: ['document', 'photo', 'proof'] }) @IsOptional() @IsIn(['document', 'photo', 'proof']) kind?: 'document' | 'photo' | 'proof';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) note?: string;
}
