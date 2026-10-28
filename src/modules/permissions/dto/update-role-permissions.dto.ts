import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsUUID, ValidateNested } from 'class-validator';

class RolePermissionEntryDto {
  @ApiProperty() @IsUUID() permission_id: string;
  @ApiProperty({ enum: ['all', 'department', 'own'] }) @IsIn(['all', 'department', 'own']) scope: 'all' | 'department' | 'own';
  @ApiProperty() @IsBoolean() granted: boolean;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [RolePermissionEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RolePermissionEntryDto)
  permissions: RolePermissionEntryDto[];
}
