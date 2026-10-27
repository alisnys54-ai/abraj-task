import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddWatcherDto {
  @ApiProperty() @IsUUID() user_id: string;
}
