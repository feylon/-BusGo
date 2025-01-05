import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InternalTokenGuard, ServiceBus, runHealthChecks } from '@bus/shared';
import { AuditQuery, AuditService } from './audit.service';

@Controller()
export class AppController {
  constructor(
    private readonly audit: AuditService,
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

  @UseGuards(InternalTokenGuard)
  @Get('audit')
  list(@Query() q: AuditQuery) {
    return this.audit.list(q);
  }

  @UseGuards(InternalTokenGuard)
  @Get('audit/actions')
  actions() {
    return this.audit.actions();
  }

  @UseGuards(InternalTokenGuard)
  @Get('audit/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.get(id);
  }

  @UseGuards(InternalTokenGuard)
  @Post('jobs/cleanup')
  @HttpCode(200)
  cleanup() {
    return this.audit.cleanup();
  }
}
