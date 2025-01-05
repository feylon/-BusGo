import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { RoleName } from '@bus/types';
import { env } from '@bus/config';
import { RedisService } from '../../common/redis.service';

export const TRACKING_CHANNEL = 'tracking:location';
const STAFF = [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.DISPATCHER] as string[];

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnModuleInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    if (process.env.REALTIME_DISABLED === 'true') return;
    try {
      await this.redis.subscriber.connect().catch(() => undefined);
      await this.redis.subscriber.subscribe(TRACKING_CHANNEL);
      this.redis.subscriber.on('message', (channel, raw) => {
        if (channel !== TRACKING_CHANNEL) return;
        try {
          const loc = JSON.parse(raw);
          this.toTrip(loc.tripId, 'vehicle.location.updated', loc);
          this.toTracking('vehicle.location.updated', loc);
        } catch (err) {
          this.logger.warn(`Bad tracking message: ${(err as Error).message}`);
        }
      });
    } catch (err) {
      this.logger.error(`Redis subscribe failed: ${(err as Error).message}`);
    }
  }

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token as string) || (client.handshake.query?.token as string);
    if (!token) return;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; roles: string[] }>(token, {
        secret: env('JWT_SECRET', 'dev-jwt-secret-change-me'),
      });
      client.data.userId = payload.sub;
      client.data.roles = payload.roles ?? [];
      await client.join(`user:${payload.sub}`);
    } catch {
      client.emit('auth.error', { code: 'UNAUTHORIZED' });
    }
  }

  @SubscribeMessage('trip:subscribe')
  async subscribeTrip(@ConnectedSocket() client: Socket, @MessageBody() body: { tripId: string }) {
    if (!body?.tripId) return { ok: false };
    await client.join(`trip:${body.tripId}`);
    return { ok: true };
  }

  @SubscribeMessage('trip:unsubscribe')
  async unsubscribeTrip(@ConnectedSocket() client: Socket, @MessageBody() body: { tripId: string }) {
    if (body?.tripId) await client.leave(`trip:${body.tripId}`);
    return { ok: true };
  }

  @SubscribeMessage('tracking:subscribe')
  async subscribeTracking(@ConnectedSocket() client: Socket) {
    const roles: string[] = client.data.roles ?? [];
    if (!roles.some((r) => STAFF.includes(r))) return { ok: false, code: 'FORBIDDEN' };
    await client.join('tracking:all');
    return { ok: true };
  }

  toTrip(tripId: string, event: string, data: unknown) {
    this.server?.to(`trip:${tripId}`).emit(event, data);
  }

  toUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  toTracking(event: string, data: unknown) {
    this.server?.to('tracking:all').emit(event, data);
  }
}
