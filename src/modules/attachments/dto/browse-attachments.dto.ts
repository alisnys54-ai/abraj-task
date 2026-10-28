import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class BrowseAttachmentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only files uploaded by this user' }) @IsOptional() @IsUUID() user_id?: string;
}
