import { Injectable } from '@nestjs/common';
import { PortalKey } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PortalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForUser(userId: string) {
    return this.prisma.userPortalAccess.findMany({ where: { userId }, orderBy: { portal: 'asc' } });
  }

  findUser(userId: string) {
    return this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, isSystemOwner: true } });
  }

  async replaceForUser(userId: string, portals: PortalKey[], grantedBy: string) {
    await this.prisma.$transaction([
      this.prisma.userPortalAccess.deleteMany({ where: { userId, portal: { notIn: portals } } }),
      ...portals.map((portal) =>
        this.prisma.userPortalAccess.upsert({
          where: { userId_portal: { userId, portal } },
          update: {},
          create: { userId, portal, grantedBy },
        }),
      ),
    ]);
  }
}
