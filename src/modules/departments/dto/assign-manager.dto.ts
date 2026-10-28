import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignManagerDto {
  @ApiProperty() @IsUUID() user_id: string;
}
