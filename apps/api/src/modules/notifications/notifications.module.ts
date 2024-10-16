import { Body, Controller, Get, Injectable, Module, OnModuleInit, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { Repository } from 'typeorm';
import { AuditAction, NotificationChannel, NotificationType, RoleName } from '@bus/types';
import { Events, NotificationCreatedPayload, NotificationSendPayload } from '@bus/events';
import { User } from '../users/user.entity';
import { ClientsService } from '../../common/clients.service';
import { EventsService } from '../../common/events.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Audit, AuthUser, CorrelationId, CurrentUser, RequirePermissions } from '../../common/decorators';
import { PageQuery } from '../../common/dto';

export class NotificationQuery extends PageQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unread?: boolean;
}

export class PreferencesDto {
  @ApiProperty({ enum: NotificationChannel, isArray: true })
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @ApiPropertyOptional({ type: [String], description: 'Muted notification types' })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  muted?: NotificationType[];
}

export class BroadcastDto {
  @ApiProperty()
  @IsString()
  @Length(2, 150)
  title: string;

  @ApiProperty()
  @IsString()
  @Length(2, 1000)
  body: string;

  @ApiPropertyOptional({ enum: RoleName, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(Object.values(RoleName), { each: true })
  roles?: RoleName[];

  @ApiPropertyOptional({ enum: NotificationChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly clients: ClientsService,
    private readonly events: EventsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onModuleInit() {
    this.events.on<NotificationCreatedPayload>(Events.NotificationCreated, 'api.notification-push', async (e) => {
      this.realtime.toUser(e.payload.userId, 'notification.created', e.payload);
    });
  }

  list(userId: string, q: NotificationQuery) {
    return this.clients.notification.get('/notifications', { params: { ...q, userId } });
  }

  all(q: PageQuery) {
    return this.clients.notification.get('/notifications/all', { params: q });
  }

  unreadCount(userId: string) {
    return this.clients.notification.get('/notifications/unread-count', { params: { userId } });
  }

  read(userId: string, id: string) {
    return this.clients.notification.patch(`/notifications/${id}/read`, { userId });
  }

  readAll(userId: string) {
    return this.clients.notification.patch('/notifications/read-all', { userId });
  }

  preferences(userId: string) {
    return this.clients.notification.get(`/preferences/${userId}`);
  }

  updatePreferences(userId: string, dto: PreferencesDto) {
    return this.clients.notification.put(`/preferences/${userId}`, dto);
  }

  async broadcast(dto: BroadcastDto, correlationId?: string) {
    const qb = this.users.createQueryBuilder('u').leftJoin('u.roles', 'r').select(['u.id', 'u.phone', 'u.lang']).where("u.status = 'ACTIVE'");
    if (dto.roles?.length) qb.andWhere('r.name IN (:...roles)', { roles: dto.roles });
    const users = await qb.getMany();
    const recipients = users.map((u) => ({ userId: u.id, phone: u.phone, lang: u.lang as any }));
    for (let i = 0; i < recipients.length; i += 500) {
      await this.events.emit<NotificationSendPayload>(
        Events.NotificationSend,
        {
          type: NotificationType.SYSTEM,
          recipients: recipients.slice(i, i + 500),
          params: { title: dto.title, body: dto.body },
          channels: dto.channels ?? [NotificationChannel.IN_APP],
        },
        correlationId,
      );
    }
    return { recipients: recipients.length };
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: NotificationQuery) {
    return this.notifications.list(user.id, q);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Get('all')
  @RequirePermissions('notifications.manage')
  all(@Query() q: PageQuery) {
    return this.notifications.all(q);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.readAll(user.id);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.read(user.id, id);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.preferences(user.id);
  }

  @Put('preferences')
  updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: PreferencesDto) {
    return this.notifications.updatePreferences(user.id, dto);
  }

  @Post('broadcast')
  @RequirePermissions('notifications.manage')
  @Audit(AuditAction.NOTIFICATION_BROADCAST, 'notification')
  broadcast(@Body() dto: BroadcastDto, @CorrelationId() cid: string) {
    return this.notifications.broadcast(dto, cid);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
