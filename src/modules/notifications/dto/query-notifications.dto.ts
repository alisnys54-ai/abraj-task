import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryNotificationsDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean() is_read?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
}
