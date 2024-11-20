import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { DataSource } from 'typeorm';
import { CORRELATION_HEADER, InternalTokenGuard, ServiceBus, runHealthChecks } from '@bus/shared';
import { PaymentsService } from './payments.service';

class CreatePaymentBody {
  @IsUUID()
  bookingId: string;

  @IsUUID()
  userId: string;

  @IsInt()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  description?: string;
}

class CompleteBody {
  @IsBoolean()
  success: boolean;
}

class ReasonBody {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller()
export class AppController {
  constructor(
    private readonly payments: PaymentsService,
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
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments')
  create(@Body() body: CreatePaymentBody, @Headers(CORRELATION_HEADER) cid?: string) {
    return this.payments.create(body, cid);
  }

  @Get('payments')
  list(@Query() q: any) {
    return this.payments.list(q);
  }

  @Get('payments/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.details(id);
  }

  @Post('payments/:id/mock-complete')
  @HttpCode(200)
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() body: CompleteBody, @Headers(CORRELATION_HEADER) cid?: string) {
    return this.payments.complete(id, body.success, cid);
  }

  @Post('payments/:id/refund')
  @HttpCode(200)
  refund(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonBody, @Headers(CORRELATION_HEADER) cid?: string) {
    return this.payments.refund(id, body.reason, cid);
  }

  @Post('payments/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonBody) {
    return this.payments.cancel(id, body.reason);
  }

  @Post('jobs/payment-timeout')
  @HttpCode(200)
  timeout() {
    return this.payments.expire();
  }
}
