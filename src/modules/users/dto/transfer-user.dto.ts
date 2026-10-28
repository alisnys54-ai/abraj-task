import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class TransferUserDto {
  @ApiProperty() @IsUUID() to_department_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() to_position_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) reason?: string;
}
