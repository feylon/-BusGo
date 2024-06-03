import { Controller, Get, Module, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { runHealthChecks } from '@bus/shared';
import { RedisService } from '../../common/redis.service';
import { EventsService } from '../../common/events.service';
import { ClientsService } from '../../common/clients.service';
import { Public, RequirePermissions } from '../../common/decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly ds: DataSource,
    private readonly redis: RedisService,
    private readonly events: EventsService,
    private readonly clients: ClientsService,
  ) {}

  @Public()
  @Get()
  async health(@Res() res: any) {
    const { ok, body } = await runHealthChecks({
      database: async () => !!(await this.ds.query('SELECT 1')),
      redis: () => this.redis.ping(),
      rabbitmq: () => this.events.connected,
    });
    res.status(ok ? 200 : 503).json(body);
  }

  @ApiBearerAuth()
  @Get('services')
  @RequirePermissions('settings.manage')
  async services() {
    const names = ['notification', 'sms', 'audit', 'tracking', 'payment', 'scheduler', 'reporting'] as const;
    const results = await Promise.all(
      names.map(async (n) => {
        try {
          const body = await this.clients[n].get<any>('/health');
          return { name: `${n}-service`, status: body.status ?? 'ok', checks: body.checks ?? {} };
        } catch (err: any) {
          return { name: `${n}-service`, status: 'down', error: err?.code ?? err?.message };
        }
      }),
    );
    let jobs: unknown = [];
    try {
      jobs = await this.clients.scheduler.get('/jobs');
    } catch {
      jobs = [];
    }
    return { services: results, jobs };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
