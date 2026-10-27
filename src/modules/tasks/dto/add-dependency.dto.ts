import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class AddDependencyDto {
  @ApiProperty() @IsUUID() depends_on_task_id: string;
  @ApiProperty({ enum: ['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'] })
  @IsIn(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'])
  type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
}
