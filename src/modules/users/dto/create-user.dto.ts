import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty() @IsString() @MaxLength(120) full_name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsUUID() department_id: string;
  @ApiProperty() @IsUUID() role_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() position_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
}
