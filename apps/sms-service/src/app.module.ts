import { Module } from '@nestjs/common';
import { ServiceBus } from '@bus/shared';
import { AppController } from './app.controller';
import { OtpService } from './otp.service';
import { SmsService } from './sms.service';
import { redisProvider } from './redis.provider';
import { SMS_PROVIDER, createSmsProvider } from './sms.provider';

@Module({
  controllers: [AppController],
  providers: [
    redisProvider,
    { provide: SMS_PROVIDER, useFactory: () => createSmsProvider() },
    { provide: ServiceBus, useFactory: () => new ServiceBus('sms') },
    OtpService,
    SmsService,
  ],
})
export class AppModule {}
