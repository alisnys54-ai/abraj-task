import { ApiProperty } from '@nestjs/swagger';

export class PublicUserDto {
  @ApiProperty() id: string;
  @ApiProperty() full_name: string;
  @ApiProperty() email: string;
  @ApiProperty() is_system_owner: boolean;
}

export class LoginResponseDto {
  @ApiProperty() access_token: string;
  @ApiProperty() refresh_token: string;
  @ApiProperty({ type: PublicUserDto }) user: PublicUserDto;
  @ApiProperty() force_password_change: boolean;
}

export class RefreshResponseDto {
  @ApiProperty() access_token: string;
  @ApiProperty() refresh_token: string;
}
