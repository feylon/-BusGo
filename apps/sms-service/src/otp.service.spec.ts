import RedisMock from 'ioredis-mock';
import { OtpService } from './otp.service';
import { SmsService } from './sms.service';
import { MockSmsProvider } from './sms.provider';

describe('OtpService', () => {
  let redis: any;
  let otp: OtpService;
  const events: string[] = [];
  const sent: string[] = [];

  beforeEach(async () => {
    process.env.OTP_EXPOSE_CODE = 'true';
    redis = new RedisMock();
    await redis.flushall();
    const bus = { emit: async (type: string) => void events.push(type), on: () => undefined } as any;
    const provider = new MockSmsProvider();
    jest.spyOn(provider, 'send').mockImplementation(async (_p: string, text: string) => {
      sent.push(text);
      return { id: 'x' };
    });
    const sms = new SmsService(redis, provider, bus);
    otp = new OtpService(redis, sms, bus);
  });

  it('sends a 6 digit code, normalizes the phone and stores only a hash', async () => {
    const res = await otp.send('+998 (90) 123-45-67');
    expect(res.phone).toBe('998901234567');
    expect(res.devCode).toMatch(/^\d{6}$/);
    const stored = JSON.parse(await redis.get('otp:998901234567'));
    expect(stored.hash).not.toContain(res.devCode);
    expect(await redis.ttl('otp:998901234567')).toBeGreaterThan(0);
    expect(sent[sent.length - 1]).toContain(res.devCode);
    expect(events).toContain('otp.requested');
  });

  it('enforces resend cooldown', async () => {
    await otp.send('998901234567');
    await expect(otp.send('998901234567')).rejects.toMatchObject({ code: 'OTP_COOLDOWN' });
  });

  it('verifies the correct code once', async () => {
    const { devCode } = await otp.send('998901234568');
    await expect(otp.verify('998901234568', devCode!)).resolves.toEqual({ verified: true, phone: '998901234568' });
    await expect(otp.verify('998901234568', devCode!)).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
    expect(await redis.get('otp:verified:998901234568')).toBe('LOGIN');
  });

  it('limits wrong attempts', async () => {
    const { devCode } = await otp.send('998901234569');
    const wrong = devCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < otp.maxAttempts - 1; i++) {
      await expect(otp.verify('998901234569', wrong)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    }
    await expect(otp.verify('998901234569', wrong)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(otp.verify('998901234569', devCode!)).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });

  it('rejects invalid phone numbers', async () => {
    await expect(otp.send('12345')).rejects.toMatchObject({ code: 'INVALID_PHONE' });
  });
});
