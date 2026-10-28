import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryFileHubDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Company-wide viewers only; department managers are always locked to their own' }) @IsOptional() @IsUUID() department_id?: string;
  @ApiPropertyOptional({ enum: ['document', 'photo', 'proof'] }) @IsOptional() @IsIn(['document', 'photo', 'proof']) kind?: 'document' | 'photo' | 'proof';
}
