import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty() @IsString() body: string;
  @ApiPropertyOptional({ description: 'Reply to another comment — enables threading' }) @IsOptional() @IsUUID() parent_comment_id?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) mentioned_user_ids?: string[];
}
