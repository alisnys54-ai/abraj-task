import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService, RequestMeta } from './token.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (user.status !== 'active') throw new ForbiddenException('Account is inactive');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const primaryRole = await this.prisma.userRole.findFirst({ where: { userId: user.id }, orderBy: { assignedAt: 'asc' } });
    if (!primaryRole) throw new ForbiddenException('Account has no assigned role');

    const accessToken = await this.tokens.issueAccessToken(user.id, primaryRole.roleId, user.isSystemOwner, user.mustChangePassword);
    const { raw: refreshToken } = await this.tokens.issueRefreshToken(user.id, meta);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.toPublicUser(user),
      force_password_change: user.mustChangePassword,
    };
  }

  async refresh(dto: RefreshTokenDto, meta: RequestMeta) {
    const { raw, userId } = await this.tokens.rotateRefreshToken(dto.refresh_token, meta);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const primaryRole = await this.prisma.userRole.findFirst({ where: { userId }, orderBy: { assignedAt: 'asc' } });

    const accessToken = await this.tokens.issueAccessToken(user.id, primaryRole?.roleId ?? '', user.isSystemOwner, user.mustChangePassword);
    return { access_token: accessToken, refresh_token: raw };
  }

  async logout(dto: RefreshTokenDto) {
    await this.tokens.revokeRefreshToken(dto.refresh_token);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await argon2.verify(user.passwordHash, dto.current_password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    if (dto.current_password === dto.new_password) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const newHash = await argon2.hash(dto.new_password);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash, mustChangePassword: false } });
    await this.tokens.revokeAllForUser(userId);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (user) {
      const raw = randomBytes(32).toString('hex');
      const tokenHash = this.tokens.hashToken(raw);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
      // Sending the email itself is out of scope for this phase — it belongs to the
      // Notifications module's email_notification_queue (approved DB design), once built.
    }
    // Always resolves the same way regardless of match — never reveals whether the email exists.
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.tokens.hashToken(dto.token);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Reset token is invalid or expired');
    }

    const newHash = await argon2.hash(dto.new_password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash: newHash, mustChangePassword: false } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    await this.tokens.revokeAllForUser(record.userId);
  }

  private toPublicUser(user: { id: string; fullName: string; email: string; isSystemOwner: boolean }) {
    return { id: user.id, full_name: user.fullName, email: user.email, is_system_owner: user.isSystemOwner };
  }
}
