import { Controller, Get, HttpCode, NotFoundException, Param, Post, Res, UseGuards } from '@nestjs/common';
import { InternalTokenGuard, runHealthChecks } from '@bus/shared';
import { SchedulerService } from './scheduler.service';

@Controller()
export class AppController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Get('health')
  async health(@Res() res: any) {
    const { ok, body } = await runHealthChecks({
      redis: async () => (await this.scheduler.redis.ping()) === 'PONG',
    });
    res.status(ok ? 200 : 503).json(body);
  }

  @UseGuards(InternalTokenGuard)
  @Get('jobs')
  list() {
    return this.scheduler.list();
  }

  @UseGuards(InternalTokenGuard)
  @Post('jobs/:name/run')
  @HttpCode(200)
  async run(@Param('name') name: string) {
    const res = await this.scheduler.runNow(name);
    if (!res) throw new NotFoundException();
    return res;
  }
}
