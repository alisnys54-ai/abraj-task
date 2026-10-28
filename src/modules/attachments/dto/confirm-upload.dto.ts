import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength } from 'class-validator';

/** object_key must match the shape our own upload-url step generates (uuid-filename) — rejects arbitrary/path-traversal keys a client didn't actually obtain a signed URL for. Real MinIO/S3 enforces this natively via the presigned URL itself; this regex is the interim safeguard for the local-disk stand-in. */
const OBJECT_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[^/\\]{1,200}$/i;

export class ConfirmUploadDto {
  @ApiProperty() @IsString() @Matches(OBJECT_KEY_PATTERN, { message: 'object_key must be one issued by /upload-url' }) object_key: string;
  @ApiProperty() @IsString() @MaxLength(200) file_name: string;
  @ApiProperty() @IsInt() @Max(50 * 1024 * 1024) file_size_bytes: number;
  @ApiPropertyOptional() @IsOptional() @IsString() mime_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supersedes_id?: string;
  @ApiPropertyOptional({ enum: ['document', 'photo', 'proof'], default: 'document', description: 'proof = completion evidence (photo or scanned document) required before review' })
  @IsOptional() @IsIn(['document', 'photo', 'proof']) kind?: 'document' | 'photo' | 'proof';
  @ApiPropertyOptional({ description: 'Caption, e.g. "after pouring — north side"' }) @IsOptional() @IsString() @MaxLength(300) note?: string;
}
