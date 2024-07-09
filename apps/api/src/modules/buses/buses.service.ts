import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import {
  BusLayout,
  BusSeatStatus,
  BusStatus,
  LayoutCell,
  LayoutCellKind,
  SeatType,
  TripStatus,
  seatPosition,
} from '@bus/types';
import { AppException, paginate } from '@bus/shared';
import { Bus } from './bus.entity';
import { BusSeat } from './bus-seat.entity';
import { Trip } from '../trips/trip.entity';
import { pageResult } from '../../common/dto';
import { BusQuery, CreateBusDto, LayoutDto, UpdateBusDto, UpdateSeatDto } from './buses.dto';

const ACTIVE_TRIP = [TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.IN_PROGRESS, TripStatus.DELAYED];

export function normalizeLayout(input: LayoutDto): BusLayout {
  const { rows, cols } = input;
  const seen = new Set<string>();
  const cells: LayoutCell[] = [];
  for (const c of input.cells) {
    if (c.row >= rows || c.col >= cols) throw new AppException('INVALID_LAYOUT', HttpStatus.BAD_REQUEST, { cell: c });
    const key = `${c.row}:${c.col}`;
    if (seen.has(key)) throw new AppException('INVALID_LAYOUT', HttpStatus.BAD_REQUEST, { duplicate: key });
    seen.add(key);
    if (c.kind === LayoutCellKind.EMPTY) continue;
    cells.push({ row: c.row, col: c.col, kind: c.kind });
  }
  const seats = input.cells
    .filter((c) => c.kind === LayoutCellKind.SEAT)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const numbers = new Set<string>();
  let auto = 1;
  for (const s of seats) {
    let number = s.number?.trim();
    if (!number) {
      while (numbers.has(String(auto).padStart(2, '0'))) auto++;
      number = String(auto).padStart(2, '0');
    }
    if (numbers.has(number)) throw new AppException('DUPLICATE_SEAT_NUMBER', HttpStatus.BAD_REQUEST, { number });
    numbers.add(number);
    const cell = cells.find((c) => c.row === s.row && c.col === s.col)!;
    cell.number = number;
    cell.type = s.type ?? SeatType.STANDARD;
    cell.status = s.status ?? BusSeatStatus.ACTIVE;
  }
  cells.sort((a, b) => a.row - b.row || a.col - b.col);
  return { rows, cols, cells };
}

@Injectable()
export class BusesService {
  constructor(
    @InjectRepository(Bus) private readonly buses: Repository<Bus>,
    @InjectRepository(BusSeat) private readonly seats: Repository<BusSeat>,
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    private readonly ds: DataSource,
  ) {}

  async list(q: BusQuery) {
    const { page, limit, skip } = paginate(q);
    const qb = this.buses.createQueryBuilder('b').orderBy('b.name', 'ASC').skip(skip).take(limit);
    if (q.status) qb.andWhere('b.status = :status', { status: q.status });
    if (q.search)
      qb.andWhere('(b.name ILIKE :s OR b.model ILIKE :s OR b.plateNumber ILIKE :s OR b.busNumber ILIKE :s)', {
        s: `%${q.search}%`,
      });
    const [items, total] = await qb.getManyAndCount();
    return pageResult(items, total, page, limit);
  }

  async get(id: string) {
    const bus = await this.buses.findOne({ where: { id } });
    if (!bus) throw new AppException('BUS_NOT_FOUND', HttpStatus.NOT_FOUND);
    return bus;
  }

  async details(id: string) {
    const bus = await this.get(id);
    const seats = await this.seats.find({ where: { busId: id }, order: { row: 'ASC', column: 'ASC' } });
    return { ...bus, seats };
  }

  async create(dto: CreateBusDto) {
    const plateNumber = dto.plateNumber.toUpperCase().replace(/\s/g, '');
    if (await this.buses.exist({ where: { plateNumber } })) throw new AppException('BUS_PLATE_EXISTS', HttpStatus.CONFLICT);
    const bus = await this.buses.save(
      this.buses.create({
        name: dto.name,
        model: dto.model,
        plateNumber,
        busNumber: dto.busNumber ?? null,
        amenities: dto.amenities ?? [],
        status: dto.status ?? BusStatus.ACTIVE,
      }),
    );
    if (dto.layout) await this.saveLayout(bus.id, dto.layout);
    return this.details(bus.id);
  }

  async update(id: string, dto: UpdateBusDto) {
    const bus = await this.get(id);
    if (dto.plateNumber) {
      const plate = dto.plateNumber.toUpperCase().replace(/\s/g, '');
      if (await this.buses.exist({ where: { plateNumber: plate, id: Not(id) } }))
        throw new AppException('BUS_PLATE_EXISTS', HttpStatus.CONFLICT);
      bus.plateNumber = plate;
    }
    Object.assign(bus, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.model ? { model: dto.model } : {}),
      ...(dto.busNumber !== undefined ? { busNumber: dto.busNumber } : {}),
      ...(dto.amenities ? { amenities: dto.amenities } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
    return this.buses.save(bus);
  }

  async remove(id: string) {
    const bus = await this.get(id);
    if (await this.trips.exist({ where: { busId: id, status: In(ACTIVE_TRIP) } }))
      throw new AppException('BUS_HAS_TRIPS', HttpStatus.CONFLICT);
    if (await this.trips.exist({ where: { busId: id } })) {
      bus.status = BusStatus.INACTIVE;
      await this.buses.save(bus);
      return { id, deactivated: true };
    }
    await this.buses.remove(bus);
    return { id, deleted: true };
  }

  async saveLayout(id: string, dto: LayoutDto) {
    await this.get(id);
    const layout = normalizeLayout(dto);
    const isAisle = (row: number) => (col: number) =>
      !layout.cells.some((c) => c.row === row && c.col === col && c.kind === LayoutCellKind.SEAT);
    await this.ds.transaction(async (m) => {
      await m.delete(BusSeat, { busId: id });
      const seatCells = layout.cells.filter((c) => c.kind === LayoutCellKind.SEAT);
      if (seatCells.length) {
        await m.insert(
          BusSeat,
          seatCells.map((c) => ({
            busId: id,
            number: c.number!,
            row: c.row,
            column: c.col,
            type: c.type!,
            status: c.status!,
            position: seatPosition(c.col, layout.cols, isAisle(c.row)),
            metadata: {},
          })),
        );
      }
      const capacity = seatCells.filter((c) => c.status !== BusSeatStatus.DISABLED).length;
      await m.update(Bus, id, { layout, capacity });
    });
    return this.details(id);
  }

  async updateSeat(busId: string, seatId: string, dto: UpdateSeatDto) {
    const seat = await this.seats.findOne({ where: { id: seatId, busId } });
    if (!seat) throw new AppException('SEAT_NOT_FOUND', HttpStatus.NOT_FOUND);
    if (dto.status) seat.status = dto.status;
    if (dto.type) seat.type = dto.type;
    await this.seats.save(seat);
    const bus = await this.get(busId);
    const cell = bus.layout.cells.find((c) => c.row === seat.row && c.col === seat.column);
    if (cell) {
      cell.status = seat.status;
      cell.type = seat.type;
    }
    const capacity = await this.seats.count({ where: { busId, status: Not(BusSeatStatus.DISABLED) } });
    await this.buses.update(busId, { layout: bus.layout, capacity });
    return seat;
  }
}
