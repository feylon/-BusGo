import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { Events, SmsSendPayload } from '@bus/events';
import { ServiceBus, normalizePhone } from '@bus/shared';
import { SMS_PROVIDER, SmsProvider } from './sms.provider';
import { REDIS } from './redis.provider';

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(SMS_PROVIDER) private readonly provider: SmsProvider,
    private readonly bus: ServiceBus,
  ) {}

  onModuleInit() {
    this.bus.on<SmsSendPayload>(Events.SmsSend, async (e) => {
      const fresh = await this.redis.set(`sms:event:${e.id}`, '1', 'EX', 86400, 'NX');
      if (!fresh) return;
      await this.deliver(e.payload.phone, e.payload.text, 'NOTIFICATION');
    });
  }

  async deliver(rawPhone: string, text: string, kind: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      this.logger.warn(`Skipping SMS to invalid phone ${rawPhone}`);
      return null;
    }
    const masked = /BusLine tasdiqlash kodi/.test(text) ? text.replace(/\d{6}/, '******') : text;
    const result = await this.provider.send(phone, text);
    await this.redis
      .multi()
      .lpush('sms:outbox', JSON.stringify({ id: result.id, phone, text: masked, kind, provider: this.provider.name, sentAt: new Date().toISOString() }))
      .ltrim('sms:outbox', 0, 199)
      .exec();
    return result;
  }

  async outbox(limit = 50) {
    const rows = await this.redis.lrange('sms:outbox', 0, limit - 1);
    return rows.map((r) => JSON.parse(r));
  }
}
