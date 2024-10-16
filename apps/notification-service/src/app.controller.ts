import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { InternalTokenGuard, ServiceBus, runHealthChecks } from '@bus/shared';
import { NotificationsService } from './notifications.service';

class UserBody {
  @IsUUID()
  userId: string;
}

class PreferencesBody {
  @IsArray()
  @IsString({ each: true })
  channels: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  muted?: string[];
}

@Controller()
export class AppController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly ds: DataSource,
    private readonly bus: ServiceBus,
  ) {}

  @Get('health')
  async health(@Res() res: any) {
    const { ok, body } = await runHealthChecks({
      database: async () => !!(await this.ds.query('SELECT 1')),
      rabbitmq: () => this.bus.connected,
    });
    res.status(ok ? 200 : 503).json(body);
  }
}

@UseGuards(InternalTokenGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@Query('userId', ParseUUIDPipe) userId: string, @Query() q: any) {
    return this.notifications.list(userId, q);
  }

  @Get('notifications/all')
  all(@Query() q: any) {
    return this.notifications.all(q);
  }

  @Get('notifications/unread-count')
  unread(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @Patch('notifications/read-all')
  readAll(@Body() body: UserBody) {
    return this.notifications.readAll(body.userId);
  }

  @Patch('notifications/:id/read')
  read(@Param('id', ParseUUIDPipe) id: string, @Body() body: UserBody) {
    return this.notifications.read(id, body.userId);
  }

  @Get('preferences/:userId')
  preferences(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.notifications.preferences(userId);
  }

  @Put('preferences/:userId')
  updatePreferences(@Param('userId', ParseUUIDPipe) userId: string, @Body() body: PreferencesBody) {
    return this.notifications.updatePreferences(userId, body);
  }

  @Post('jobs/cleanup')
  @HttpCode(200)
  cleanup() {
    return this.notifications.cleanup();
  }
}
