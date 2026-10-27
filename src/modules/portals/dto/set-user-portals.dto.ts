import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsIn } from 'class-validator';

export const PORTAL_KEYS = ['company', 'riyasa', 'qudah', 'tasks'] as const;

export class SetUserPortalsDto {
  @ApiProperty({ enum: PORTAL_KEYS, isArray: true, description: 'The full set of portals this user may open — replaces the current set.' })
  @IsArray()
  @ArrayUnique()
  @IsIn(PORTAL_KEYS, { each: true })
  portals: (typeof PORTAL_KEYS)[number][];
}
