import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class MoveDepartmentDto {
  @ApiPropertyOptional({ nullable: true, description: 'New parent department id — omit or send null to make this a root department' })
  @IsOptional()
  @IsUUID()
  parent_department_id?: string | null;
}
