import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryActivityLogDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() user_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() task_id?: string;
}
