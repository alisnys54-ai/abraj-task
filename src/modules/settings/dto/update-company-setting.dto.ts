import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCompanySettingDto {
  @ApiProperty({ example: 'company_name' }) @IsString() @IsNotEmpty() key: string;
  @ApiProperty({ description: 'Any JSON-serializable value' }) value: unknown;
}
