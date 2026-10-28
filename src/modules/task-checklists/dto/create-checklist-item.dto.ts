import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateChecklistItemDto {
  @ApiProperty() @IsString() @MaxLength(240) text: string;
}
