import { Body, Controller, Get, HttpCode, Inject, Post, Query, Res, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import Redis from 'ioredis';
import { InternalTokenGuard, ServiceBus, runHealthChecks } from '@bus/shared';
import { OtpService } from './otp.service';
import { SmsService } from './sms.service';
import { REDIS } from './redis.provider';

class SendOtpDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsIn(['LOGIN', 'REGISTER', 'RESET'])
  purpose?: string;
}

class VerifyOtpDto {
  @IsString()
  phone: string;

  @Matches(/^\d{6}$/)
  code: string;
}

class SendSmsDto {
  @IsString()
  phone: string;

  @IsString()
  @Length(1, 500)
  text: string;
}

@Controller()
export class AppController {
  constructor(
    private readonly otp: OtpService,
    private readonly sms: SmsService,
    private readonly bus: ServiceBus,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('health')
  async health(@Res() res: any) {
    const { ok, body } = await runHealthChecks({
      redis: async () => (await this.redis.ping()) === 'PONG',
      rabbitmq: () => this.bus.connected,
    });
    res.status(ok ? 200 : 503).json(body);
  }

  @UseGuards(InternalTokenGuard)
  @Post('otp/send')
  @HttpCode(200)
  send(@Body() dto: SendOtpDto) {
    return this.otp.send(dto.phone, dto.purpose);
  }

  @UseGuards(InternalTokenGuard)
  @Post('otp/verify')
  @HttpCode(200)
  verify(@Body() dto: VerifyOtpDto) {
    return this.otp.verify(dto.phone, dto.code);
  }

  @UseGuards(InternalTokenGuard)
  @Get('otp/status')
  status(@Query('phone') phone: string) {
    return this.otp.status(phone);
  }

  @UseGuards(InternalTokenGuard)
  @Post('sms/send')
  @HttpCode(200)
  sendSms(@Body() dto: SendSmsDto) {
    return this.sms.deliver(dto.phone, dto.text, 'MANUAL');
  }

  @UseGuards(InternalTokenGuard)
  @Get('sms/outbox')
  outbox(@Query('limit') limit?: string) {
    return this.sms.outbox(Math.min(Number(limit) || 50, 200));
  }
}
