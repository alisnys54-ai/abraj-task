import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryTasksDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() department_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignee_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() project_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parent_task_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() due_before?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() due_after?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tag?: string;
  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean() overdue?: boolean;
}
