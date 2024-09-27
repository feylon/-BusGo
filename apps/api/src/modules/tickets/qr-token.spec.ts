import { randomUUID } from 'node:crypto';
import { createQrToken, parseQrToken } from './qr-token';

describe('QR token', () => {
  it('round-trips a signed ticket id', () => {
    const id = randomUUID();
    const token = createQrToken(id);
    expect(token.startsWith('BT1.')).toBe(true);
    expect(parseQrToken(token)).toEqual({ ticketId: id });
  });

  it('produces different tokens for the same ticket', () => {
    const id = randomUUID();
    expect(createQrToken(id)).not.toEqual(createQrToken(id));
  });

  it('rejects tampered or foreign tokens', () => {
    const token = createQrToken(randomUUID());
    const parts = token.split('.');
    expect(parseQrToken(`${parts[0]}.${randomUUID()}.${parts[2]}.${parts[3]}`)).toBeNull();
    expect(parseQrToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'))).toBeNull();
    expect(parseQrToken('not-a-token')).toBeNull();
    expect(parseQrToken(randomUUID())).toBeNull();
  });
});
