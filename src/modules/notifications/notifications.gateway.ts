import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Minimal authenticated push channel: the client connects with its existing
 * access token (same RS256 keypair auth already used everywhere else — no
 * second credential to manage), joins a room named after its own userId, and
 * NotificationsService.dispatch() emits into each recipient's room. Falls
 * back to nothing gracefully — if a client never connects, DB-backed
 * GET /notifications (with client-side polling) still works exactly as before.
 */
@WebSocketGateway({ cors: true, namespace: '/ws/notifications' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('NotificationsGateway');

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string) ?? (client.handshake.query?.token as string);
      if (!token) throw new Error('No token provided');
      const payload = await this.jwt.verifyAsync(token, { publicKey: this.config.get<string>('jwt.accessPublicKey'), algorithms: ['RS256'] });
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
    } catch (e) {
      this.logger.warn(`Rejected socket connection: ${(e as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect() {
    // Rooms are cleaned up automatically by Socket.IO on disconnect.
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
