import { Logger } from '@nestjs/common';

export interface SmsProvider {
  readonly name: string;
  send(phone: string, text: string): Promise<{ id: string }>;
}

export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';
  private readonly logger = new Logger('MockSmsProvider');

  async send(phone: string, text: string) {
    const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const otp = /kodi: (\d{6})/.exec(text)?.[1];
    this.logger.log(`\n[MOCK SMS]\nPhone: +${phone}\n${otp ? `OTP: ${otp}` : `Text: ${text}`}\n`);
    return { id };
  }
}

export const SMS_PROVIDER = 'SMS_PROVIDER';

export function createSmsProvider(name = process.env.SMS_PROVIDER ?? 'mock'): SmsProvider {
  switch (name) {
    case 'mock':
      return new MockSmsProvider();
    default:
      throw new Error(`SMS provider "${name}" is not configured`);
  }
}
