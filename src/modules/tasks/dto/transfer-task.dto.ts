import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class TransferTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() department_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignee_id?: string;
}
