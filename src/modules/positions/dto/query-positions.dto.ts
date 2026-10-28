import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryPositionsDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() department_id?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @ToBoolean() @IsBoolean() include_archived?: boolean = false;
}
