import { Logger } from '@nestjs/common';

export interface PushMessage {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushProvider {
  readonly name: string;
  send(message: PushMessage): Promise<{ id: string }>;
}

export class MockPushProvider implements PushProvider {
  readonly name = 'mock';
  private readonly logger = new Logger('MockPushProvider');

  async send(message: PushMessage) {
    this.logger.log(`[MOCK PUSH] user=${message.userId} "${message.title}" — ${message.body}`);
    return { id: `push-${Date.now()}` };
  }
}

export const PUSH_PROVIDER = 'PUSH_PROVIDER';

export function createPushProvider(name = process.env.PUSH_PROVIDER ?? 'mock'): PushProvider {
  switch (name) {
    case 'mock':
      return new MockPushProvider();
    default:
      throw new Error(`Push provider "${name}" is not configured`);
  }
}
