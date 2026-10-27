import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsString, MaxLength } from 'class-validator';

export class CreateSavedFilterDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiProperty({ enum: ['board', 'list', 'calendar', 'reports'] })
  @IsIn(['board', 'list', 'calendar', 'reports'])
  view_type: 'board' | 'list' | 'calendar' | 'reports';
  @ApiProperty() @IsObject() filters: Record<string, unknown>;
}
