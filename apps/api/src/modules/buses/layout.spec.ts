import { BusSeatStatus, LayoutCellKind, SeatType, buildStandardLayout } from '@bus/types';
import { AppException } from '@bus/shared';
import { normalizeLayout } from './buses.service';

describe('dynamic seat layout', () => {
  it('builds a 2+2 coach with a full last row', () => {
    const layout = buildStandardLayout(12, 2, 2);
    const seats = layout.cells.filter((c) => c.kind === LayoutCellKind.SEAT);
    expect(seats).toHaveLength(11 * 4 + 5);
    expect(new Set(seats.map((s) => s.number)).size).toBe(seats.length);
  });

  it('auto-numbers seats without a number and keeps custom numbers', () => {
    const layout = normalizeLayout({
      rows: 2,
      cols: 3,
      cells: [
        { row: 0, col: 0, kind: LayoutCellKind.DRIVER },
        { row: 1, col: 0, kind: LayoutCellKind.SEAT },
        { row: 1, col: 1, kind: LayoutCellKind.AISLE },
        { row: 1, col: 2, kind: LayoutCellKind.SEAT, number: 'A1', type: SeatType.VIP, status: BusSeatStatus.BLOCKED },
      ],
    });
    const seats = layout.cells.filter((c) => c.kind === LayoutCellKind.SEAT);
    expect(seats.map((s) => s.number)).toEqual(['01', 'A1']);
    expect(seats[1]).toMatchObject({ type: SeatType.VIP, status: BusSeatStatus.BLOCKED });
  });

  it('rejects duplicate seat numbers and out of bounds cells', () => {
    expect(() =>
      normalizeLayout({
        rows: 1,
        cols: 2,
        cells: [
          { row: 0, col: 0, kind: LayoutCellKind.SEAT, number: '1' },
          { row: 0, col: 1, kind: LayoutCellKind.SEAT, number: '1' },
        ],
      }),
    ).toThrow(AppException);
    expect(() => normalizeLayout({ rows: 1, cols: 1, cells: [{ row: 3, col: 0, kind: LayoutCellKind.SEAT }] })).toThrow(AppException);
  });
});
