import { randomBytes } from 'node:crypto';
import { Payment } from './payment.entity';

export interface CheckoutResult {
  transactionId: string;
  checkoutUrl: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(payment: Payment): Promise<CheckoutResult>;
  confirm(payment: Payment, success: boolean): Promise<{ success: boolean; reason?: string }>;
  refund(payment: Payment): Promise<{ refundId: string }>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createCheckout(payment: Payment) {
    const base = process.env.FRONTEND_URL?.split(',')[0] ?? '';
    return {
      transactionId: `MOCK-${randomBytes(6).toString('hex').toUpperCase()}`,
      checkoutUrl: `${base}/payment/mock/${payment.id}`,
    };
  }

  async confirm(_payment: Payment, success: boolean) {
    return success ? { success: true } : { success: false, reason: 'CARD_DECLINED' };
  }

  async refund() {
    return { refundId: `MOCK-R-${randomBytes(5).toString('hex').toUpperCase()}` };
  }
}

export const PAYMENT_PROVIDERS = 'PAYMENT_PROVIDERS';

export function createProviders(): Map<string, PaymentProvider> {
  const enabled = (process.env.PAYMENT_PROVIDER ?? 'mock').split(',').map((p) => p.trim());
  const map = new Map<string, PaymentProvider>();
  for (const name of enabled) {
    if (name === 'mock') map.set(name, new MockPaymentProvider());
    else throw new Error(`Payment provider "${name}" is not configured`);
  }
  return map;
}
