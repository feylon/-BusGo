import { SeatType } from '@bus/types';
import { PricingService, roundPrice } from './pricing.service';

const stop = (id: string, order: number, km: number) => ({ stopId: id, order, distanceFromStartKm: km }) as any;

function service(rules: any[]) {
  const qb: any = {
    where: () => qb,
    andWhere: () => qb,
    orderBy: () => qb,
    addOrderBy: () => qb,
    getMany: async () => rules,
  };
  const repo = { createQueryBuilder: () => qb } as any;
  const settings = { seatMultipliers: async () => ({ STANDARD: 1, COMFORT: 1.2, VIP: 1.5, ACCESSIBLE: 1 }) } as any;
  return new PricingService(repo, {} as any, {} as any, settings);
}

const seg = { from: stop('A', 1, 0), to: stop('C', 3, 300), first: stop('A', 1, 0), last: stop('C', 3, 300) };

describe('pricing', () => {
  it('uses an exact seat-type rule first', async () => {
    const p = service([
      { id: 'vip', seatType: SeatType.VIP, price: 130000 },
      { id: 'any', seatType: null, price: 80000 },
    ]);
    expect(await p.quote({ routeId: 'r', basePrice: 70000, seg, seatType: SeatType.VIP })).toEqual({ price: 130000, ruleId: 'vip' });
  });

  it('applies seat multipliers to a generic segment rule', async () => {
    const p = service([{ id: 'any', seatType: null, price: 80000 }]);
    expect((await p.quote({ routeId: 'r', basePrice: 70000, seg, seatType: SeatType.COMFORT })).price).toBe(96000);
  });

  it('falls back to a distance share of the trip base price', async () => {
    const p = service([]);
    const part = { ...seg, to: stop('B', 2, 150) };
    expect((await p.quote({ routeId: 'r', basePrice: 80000, seg: part, seatType: SeatType.STANDARD })).price).toBe(40000);
    expect((await p.quote({ routeId: 'r', basePrice: 80000, seg, seatType: SeatType.STANDARD })).price).toBe(80000);
  });

  it('rounds prices to thousands', () => {
    expect(roundPrice(44499)).toBe(44000);
    expect(roundPrice(44500)).toBe(45000);
    expect(roundPrice(10)).toBe(1000);
  });
});
