import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { AppException, haversineKm, paginate } from '@bus/shared';
import { Route } from './route.entity';
import { RouteStop } from './route-stop.entity';
import { Stop } from '../stops/stop.entity';
import { Trip } from '../trips/trip.entity';
import { pageResult } from '../../common/dto';
import { CreateRouteDto, RouteQuery, RouteStopDto, UpdateRouteDto } from './routes.dto';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route) private readonly routes: Repository<Route>,
    @InjectRepository(Stop) private readonly stops: Repository<Stop>,
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    private readonly ds: DataSource,
  ) {}

  async list(q: RouteQuery, onlyActive = false) {
    const { page, limit, skip } = paginate(q);
    const qb = this.routes
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.origin', 'o')
      .leftJoinAndSelect('r.destination', 'd')
      .leftJoinAndSelect('r.stops', 'rs')
      .leftJoinAndSelect('rs.stop', 's')
      .orderBy('r.name', 'ASC')
      .skip(skip)
      .take(limit);
    if (onlyActive) qb.andWhere('r.active = true');
    if (q.search) qb.andWhere('(r.name ILIKE :s OR r.code ILIKE :s)', { s: `%${q.search}%` });
    if (q.city)
      qb.andWhere(
        'r.id IN (SELECT rs2."routeId" FROM route_stops rs2 JOIN stops s2 ON s2.id = rs2."stopId" WHERE s2.city ILIKE :city)',
        { city: q.city },
      );
    const [items, total] = await qb.getManyAndCount();
    for (const r of items) r.stops?.sort((a, b) => a.order - b.order);
    return pageResult(items, total, page, limit);
  }

  async get(id: string) {
    const route = await this.routes.findOne({
      where: { id },
      relations: { origin: true, destination: true, stops: { stop: true } },
      order: { stops: { order: 'ASC' } },
    });
    if (!route) throw new AppException('ROUTE_NOT_FOUND', HttpStatus.NOT_FOUND);
    return route;
  }

  private async buildStops(input: RouteStopDto[]) {
    const ids = input.map((s) => s.stopId);
    if (new Set(ids).size !== ids.length) throw new AppException('INVALID_ROUTE_STOPS', HttpStatus.BAD_REQUEST);
    const stops = await this.stops.find({ where: { id: In(ids) } });
    if (stops.length !== ids.length) throw new AppException('STOP_NOT_FOUND', HttpStatus.BAD_REQUEST);
    const byId = new Map(stops.map((s) => [s.id, s]));
    let prevOffset = -1;
    let distance = 0;
    return input.map((s, i) => {
      if (s.arrivalOffsetMin < prevOffset || s.departureOffsetMin < s.arrivalOffsetMin)
        throw new AppException('INVALID_ROUTE_STOPS', HttpStatus.BAD_REQUEST, { index: i });
      prevOffset = s.departureOffsetMin;
      if (i > 0) {
        const a = byId.get(input[i - 1].stopId)!;
        const b = byId.get(s.stopId)!;
        distance += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1.2;
      }
      return {
        stopId: s.stopId,
        order: i + 1,
        arrivalOffsetMin: s.arrivalOffsetMin,
        departureOffsetMin: s.departureOffsetMin,
        distanceFromStartKm: s.distanceFromStartKm ?? Math.round(distance),
      };
    });
  }

  async create(dto: CreateRouteDto) {
    const code = dto.code.toUpperCase();
    if (await this.routes.exist({ where: { code } })) throw new AppException('ROUTE_CODE_EXISTS', HttpStatus.CONFLICT, { code });
    const stops = await this.buildStops(dto.stops);
    const last = stops[stops.length - 1];
    const route = await this.ds.transaction(async (m) => {
      const saved = await m.save(
        m.create(Route, {
          name: dto.name,
          code,
          originId: stops[0].stopId,
          destinationId: last.stopId,
          distanceKm: dto.distanceKm ?? last.distanceFromStartKm,
          durationMin: dto.durationMin ?? last.arrivalOffsetMin,
          active: dto.active ?? true,
        }),
      );
      await m.insert(
        RouteStop,
        stops.map((s) => ({ ...s, routeId: saved.id })),
      );
      return saved;
    });
    return this.get(route.id);
  }

  async update(id: string, dto: UpdateRouteDto) {
    const route = await this.get(id);
    if (dto.code) {
      const code = dto.code.toUpperCase();
      if (await this.routes.exist({ where: { code, id: Not(id) } }))
        throw new AppException('ROUTE_CODE_EXISTS', HttpStatus.CONFLICT, { code });
      route.code = code;
    }
    if (dto.name) route.name = dto.name;
    if (dto.active !== undefined) route.active = dto.active;
    await this.ds.transaction(async (m) => {
      if (dto.stops) {
        const stops = await this.buildStops(dto.stops);
        const last = stops[stops.length - 1];
        await m.delete(RouteStop, { routeId: id });
        await m.insert(
          RouteStop,
          stops.map((s) => ({ ...s, routeId: id })),
        );
        route.originId = stops[0].stopId;
        route.destinationId = last.stopId;
        route.distanceKm = dto.distanceKm ?? last.distanceFromStartKm;
        route.durationMin = dto.durationMin ?? last.arrivalOffsetMin;
      } else {
        if (dto.distanceKm !== undefined) route.distanceKm = dto.distanceKm;
        if (dto.durationMin !== undefined) route.durationMin = dto.durationMin;
      }
      const { stops: _s, origin: _o, destination: _d, ...plain } = route;
      await m.update(Route, id, plain);
    });
    return this.get(id);
  }

  async remove(id: string) {
    const route = await this.get(id);
    if (await this.trips.exist({ where: { routeId: id } })) {
      route.active = false;
      await this.routes.update(id, { active: false });
      return { id, deactivated: true };
    }
    await this.routes.delete(id);
    return { id, deleted: true };
  }
}
