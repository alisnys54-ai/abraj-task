import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginResponseDto, RefreshResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AllowWhenPasswordChangeRequired } from '../../common/decorators/allow-when-password-change-required.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

function requestMeta(req: Request) {
  return { deviceLabel: req.header('user-agent')?.slice(0, 120), ipAddress: req.ip };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email + password' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, requestMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new access + refresh pair (rotates the refresh token)' })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto, requestMeta(req));
  }

  @AllowWhenPasswordChangeRequired()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto);
  }

  @AllowWhenPasswordChangeRequired()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change own password — also clears must_change_password and revokes all other sessions' })
  async changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(userId, dto);
    return {};
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a password reset email — always returns 202, regardless of whether the email exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a password reset via the emailed single-use token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return {};
  }
}
