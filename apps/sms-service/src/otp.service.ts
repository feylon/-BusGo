import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import Redis from 'ioredis';
import { Events, OtpEventPayload } from '@bus/events';
import { AppException, ServiceBus, normalizePhone, randomDigits } from '@bus/shared';
import { envBool, envInt, isProd } from '@bus/config';
import { REDIS } from './redis.provider';
import { SmsService } from './sms.service';

interface StoredOtp {
  hash: string;
  attempts: number;
  purpose: string;
  createdAt: number;
}

export const otpKey = (phone: string) => `otp:${phone}`;

@Injectable()
export class OtpService {
  readonly ttl = envInt('OTP_TTL_SEC', 120);
  readonly cooldown = envInt('OTP_RESEND_COOLDOWN_SEC', 60);
  readonly maxAttempts = envInt('OTP_MAX_ATTEMPTS', 5);
  readonly hourlyLimit = envInt('OTP_HOURLY_LIMIT', 5);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly sms: SmsService,
    private readonly bus: ServiceBus,
  ) {}

  private hash(phone: string, code: string) {
    return createHash('sha256').update(`${phone}:${code}:${process.env.OTP_SECRET ?? 'dev-otp-secret'}`).digest('hex');
  }

  private phone(raw: string) {
    const phone = normalizePhone(raw);
    if (!phone) throw new AppException('INVALID_PHONE');
    return phone;
  }

  async send(rawPhone: string, purpose = 'LOGIN', correlationId?: string) {
    const phone = this.phone(rawPhone);
    const cooldownLeft = await this.redis.ttl(`otp:cooldown:${phone}`);
    if (cooldownLeft > 0) throw new AppException('OTP_COOLDOWN', HttpStatus.TOO_MANY_REQUESTS, { retryAfter: cooldownLeft });
    const hourKey = `otp:hourly:${phone}`;
    const count = await this.redis.incr(hourKey);
    if (count === 1) await this.redis.expire(hourKey, 3600);
    if (count > this.hourlyLimit) throw new AppException('OTP_COOLDOWN', HttpStatus.TOO_MANY_REQUESTS, { retryAfter: await this.redis.ttl(hourKey) });

    const code = randomDigits(6);
    const stored: StoredOtp = { hash: this.hash(phone, code), attempts: 0, purpose, createdAt: Date.now() };
    await this.redis
      .multi()
      .set(otpKey(phone), JSON.stringify(stored), 'EX', this.ttl)
      .set(`otp:cooldown:${phone}`, '1', 'EX', this.cooldown)
      .del(`otp:verified:${phone}`)
      .exec();

    await this.sms.deliver(phone, `BusLine tasdiqlash kodi: ${code}. Kod ${Math.round(this.ttl / 60)} daqiqa amal qiladi.`, 'OTP');
    await this.bus.emit<OtpEventPayload>(Events.OtpRequested, { phone, purpose }, correlationId);
    const expose = envBool('OTP_EXPOSE_CODE', !isProd());
    return { phone, expiresIn: this.ttl, resendIn: this.cooldown, ...(expose ? { devCode: code } : {}) };
  }

  async verify(rawPhone: string, code: string, correlationId?: string) {
    const phone = this.phone(rawPhone);
    const key = otpKey(phone);
    const raw = await this.redis.get(key);
    if (!raw) throw new AppException('OTP_EXPIRED');
    const stored: StoredOtp = JSON.parse(raw);
    if (stored.attempts >= this.maxAttempts) {
      await this.redis.del(key);
      throw new AppException('OTP_ATTEMPTS_EXCEEDED', HttpStatus.TOO_MANY_REQUESTS);
    }
    const expected = Buffer.from(stored.hash);
    const given = Buffer.from(this.hash(phone, String(code)));
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      stored.attempts++;
      const ttl = await this.redis.ttl(key);
      if (stored.attempts >= this.maxAttempts) await this.redis.del(key);
      else await this.redis.set(key, JSON.stringify(stored), 'EX', Math.max(ttl, 1));
      throw new AppException('OTP_INVALID', HttpStatus.BAD_REQUEST, { attemptsLeft: Math.max(0, this.maxAttempts - stored.attempts) });
    }
    await this.redis.multi().del(key).set(`otp:verified:${phone}`, stored.purpose, 'EX', 600).exec();
    await this.bus.emit<OtpEventPayload>(Events.OtpVerified, { phone, purpose: stored.purpose }, correlationId);
    return { verified: true, phone };
  }

  async status(rawPhone: string) {
    const phone = this.phone(rawPhone);
    const [ttl, cooldown, verified] = await Promise.all([
      this.redis.ttl(otpKey(phone)),
      this.redis.ttl(`otp:cooldown:${phone}`),
      this.redis.get(`otp:verified:${phone}`),
    ]);
    return { phone, active: ttl > 0, expiresIn: Math.max(ttl, 0), resendIn: Math.max(cooldown, 0), verified: !!verified };
  }
}
