import { Body, Controller, Get, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { DataSource } from 'typeorm';
import { InternalTokenGuard, ServiceBus, runHealthChecks } from '@bus/shared';
import { ReportsService } from './reports.service';

class ReportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';

  @IsOptional()
  @IsUUID()
  routeId?: string;
}

class DailyBody {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

@Controller()
export class AppController {
  constructor(
    private readonly reports: ReportsService,
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
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports/dashboard')
  dashboard(@Query() q: ReportQueryDto) {
    return this.reports.dashboard(q);
  }

  @Get('reports/sales')
  sales(@Query() q: ReportQueryDto) {
    return this.reports.sales(q);
  }

  @Get('reports/routes')
  routes(@Query() q: ReportQueryDto) {
    return this.reports.routes(q);
  }

  @Get('reports/buses')
  buses(@Query() q: ReportQueryDto) {
    return this.reports.buses(q);
  }

  @Get('reports/drivers')
  drivers(@Query() q: ReportQueryDto) {
    return this.reports.drivers(q);
  }

  @Get('reports/trips')
  trips(@Query() q: ReportQueryDto) {
    return this.reports.trips(q);
  }

  @Get('reports/payments')
  payments(@Query() q: ReportQueryDto) {
    return this.reports.payments(q);
  }

  @Get('reports/passengers')
  passengers(@Query() q: ReportQueryDto) {
    return this.reports.passengers(q);
  }

  @Get('reports/cancellations')
  cancellations(@Query() q: ReportQueryDto) {
    return this.reports.cancellations(q);
  }

  @Get('reports/daily')
  daily(@Query() q: ReportQueryDto) {
    return this.reports.daily(q);
  }

  @Post('jobs/daily-report')
  @HttpCode(200)
  buildDaily(@Body() body: DailyBody) {
    return this.reports.buildDaily(body?.date);
  }
}
