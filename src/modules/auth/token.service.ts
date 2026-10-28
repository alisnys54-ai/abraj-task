import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export interface RequestMeta {
  deviceLabel?: string;
  ipAddress?: string;
}

/**
 * Owns the full refresh-token lifecycle: issue, rotate-on-use, revoke, and reuse
 * detection — exactly the approved Authentication Flow. Refresh tokens are opaque
 * random strings (never JWTs) and are hashed with SHA-256, not argon2: they carry
 * their own high entropy already, so a slow password-grade hash buys nothing here
 * and would needlessly slow every refresh call.
 *
 * Every multi-write sequence below runs inside a Prisma transaction — a process
 * crash mid-rotation can never leave two simultaneously-valid refresh tokens, or
 * a refresh_token row with no matching user_session row.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async issueAccessToken(userId: string, roleId: string, isSystemOwner: boolean, mustChangePassword: boolean): Promise<string> {
    const payload: JwtPayload = { sub: userId, roleId, isSystemOwner, mustChangePassword };
    return this.jwt.signAsync(payload, {
      privateKey: this.config.get<string>('jwt.accessPrivateKey'),
      algorithm: 'RS256',
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });
  }

  private refreshExpiryDate(): Date {
    const days = this.config.get<number>('jwt.refreshExpiresInDays', 30);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  async issueRefreshToken(userId: string, meta: RequestMeta) {
    const raw = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(raw);
    const id = randomUUID();
    const expiresAt = this.refreshExpiryDate();

    const [record] = await this.prisma.$transaction([
      this.prisma.refreshToken.create({
        data: { id, userId, tokenHash, deviceLabel: meta.deviceLabel, ipAddress: meta.ipAddress, expiresAt },
      }),
      this.prisma.userSession.create({
        data: { userId, refreshTokenId: id, deviceLabel: meta.deviceLabel, ipAddress: meta.ipAddress },
      }),
    ]);
    return { raw, record };
  }

  /**
   * Rotates a refresh token on every use, atomically: validate → (if this token
   * was already rotated once before, presenting it again is a reuse signal —
   * revoke every session for the user and fail) → issue the replacement →
   * revoke the presented token, all inside one transaction.
   */
  async rotateRefreshToken(rawOld: string, meta: RequestMeta) {
    const oldHash = this.hashToken(rawOld);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.refreshToken.findUnique({ where: { tokenHash: oldHash } });
      if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      if (existing.replacedById) {
        await tx.refreshToken.updateMany({ where: { userId: existing.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.userSession.updateMany({ where: { userId: existing.userId, endedAt: null }, data: { endedAt: new Date() } });
        throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
      }

      const raw = randomBytes(64).toString('hex');
      const tokenHash = this.hashToken(raw);
      const id = randomUUID();
      const expiresAt = this.refreshExpiryDate();

      const record = await tx.refreshToken.create({
        data: { id, userId: existing.userId, tokenHash, deviceLabel: meta.deviceLabel, ipAddress: meta.ipAddress, expiresAt },
      });
      await tx.userSession.create({
        data: { userId: existing.userId, refreshTokenId: id, deviceLabel: meta.deviceLabel, ipAddress: meta.ipAddress },
      });
      await tx.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date(), replacedById: record.id } });

      return { raw, userId: existing.userId };
    });
  }

  async revokeRefreshToken(raw: string) {
    const tokenHash = this.hashToken(raw);
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.userSession.updateMany({ where: { refreshToken: { tokenHash } }, data: { endedAt: new Date() } }),
    ]);
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.userSession.updateMany({ where: { userId, endedAt: null }, data: { endedAt: new Date() } }),
    ]);
  }
}
