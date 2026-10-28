import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { IsBoolean } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryDepartmentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to direct children of this department id' })
  @IsOptional()
  @IsUUID()
  parent_department_id?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  include_archived?: boolean = false;
}
