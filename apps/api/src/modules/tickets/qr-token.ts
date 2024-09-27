import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@bus/config';

const secret = () => env('QR_SECRET', 'dev-qr-secret-change-me');

const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url').slice(0, 32);

export function createQrToken(ticketId: string) {
  const nonce = randomBytes(9).toString('base64url');
  const data = `${ticketId}.${nonce}`;
  return `BT1.${data}.${sign(data)}`;
}

export function parseQrToken(token: string): { ticketId: string } | null {
  if (typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'BT1') return null;
  const [, ticketId, nonce, sig] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return null;
  const expected = sign(`${ticketId}.${nonce}`);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return { ticketId };
}
