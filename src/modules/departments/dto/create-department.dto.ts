import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty() @IsString() @MaxLength(80) name: string;
  @ApiPropertyOptional({ description: 'Parent department id — omit to create a root department' })
  @IsOptional()
  @IsUUID()
  parent_department_id?: string;
}
