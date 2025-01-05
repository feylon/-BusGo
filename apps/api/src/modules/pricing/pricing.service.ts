import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { SeatType } from '@bus/types';
import { AppException, paginate } from '@bus/shared';
import { PricingRule } from './pricing-rule.entity';
import { RouteStop } from '../routes/route-stop.entity';
import { Route } from '../routes/route.entity';
import { pageResult } from '../../common/dto';
import { SettingsService } from '../settings/settings.service';
import { CreatePricingDto, PricingQuery, UpdatePricingDto } from './pricing.dto';

export interface Segment {
  from: RouteStop;
  to: RouteStop;
  first: RouteStop;
  last: RouteStop;
}

export const roundPrice = (v: number) => Math.max(1000, Math.round(v / 1000) * 1000);

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingRule) private readonly rules: Repository<PricingRule>,
    @InjectRepository(RouteStop) private readonly routeStops: Repository<RouteStop>,
    @InjectRepository(Route) private readonly routes: Repository<Route>,
    private readonly settings: SettingsService,
  ) {}

  async segment(routeId: string, fromStopId?: string, toStopId?: string): Promise<Segment> {
    const stops = await this.routeStops.find({ where: { routeId }, order: { order: 'ASC' } });
    if (stops.length < 2) throw new AppException('INVALID_SEGMENT');
    const first = stops[0];
    const last = stops[stops.length - 1];
    const from = fromStopId ? stops.find((s) => s.stopId === fromStopId) : first;
    const to = toStopId ? stops.find((s) => s.stopId === toStopId) : last;
    if (!from || !to || from.order >= to.order) throw new AppException('INVALID_SEGMENT');
    return { from, to, first, last };
  }

  async quote(input: {
    routeId: string;
    basePrice: number;
    seg: Segment;
    seatType: SeatType;
    at?: Date;
  }): Promise<{ price: number; ruleId: string | null }> {
    const at = input.at ?? new Date();
    const rules = await this.rules
      .createQueryBuilder('p')
      .where('p.routeId = :routeId AND p.fromStopId = :from AND p.toStopId = :to AND p.active = true', {
        routeId: input.routeId,
        from: input.seg.from.stopId,
        to: input.seg.to.stopId,
      })
      .andWhere(new Brackets((b) => b.where('p.seatType = :type', { type: input.seatType }).orWhere('p.seatType IS NULL')))
      .andWhere('(p.validFrom IS NULL OR p.validFrom <= :at)', { at })
      .andWhere('(p.validTo IS NULL OR p.validTo >= :at)', { at })
      .orderBy('p.seatType', 'ASC', 'NULLS LAST')
      .addOrderBy('p.validFrom', 'DESC', 'NULLS LAST')
      .getMany();
    const exact = rules.find((r) => r.seatType === input.seatType);
    if (exact) return { price: exact.price, ruleId: exact.id };
    const multipliers = await this.settings.seatMultipliers();
    const mult = multipliers[input.seatType] ?? 1;
    const generic = rules.find((r) => r.seatType === null);
    if (generic) return { price: roundPrice(generic.price * mult), ruleId: generic.id };
    const { from, to, first, last } = input.seg;
    const total = last.distanceFromStartKm - first.distanceFromStartKm;
    const part = to.distanceFromStartKm - from.distanceFromStartKm;
    const ratio = total > 0 ? part / total : (to.order - from.order) / (last.order - first.order);
    const full = from.order === first.order && to.order === last.order;
    return { price: full ? roundPrice(input.basePrice * mult) : roundPrice(input.basePrice * ratio * mult), ruleId: null };
  }

  async list(q: PricingQuery) {
    const { page, limit, skip } = paginate(q);
    const qb = this.rules
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.route', 'r')
      .leftJoinAndSelect('p.fromStop', 'fs')
      .leftJoinAndSelect('p.toStop', 'ts')
      .orderBy('r.name', 'ASC')
      .addOrderBy('p.price', 'DESC')
      .skip(skip)
      .take(limit);
    if (q.routeId) qb.andWhere('p.routeId = :routeId', { routeId: q.routeId });
    if (q.search) qb.andWhere('(r.name ILIKE :s OR fs.name ILIKE :s OR ts.name ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return pageResult(items, total, page, limit);
  }

  async get(id: string) {
    const rule = await this.rules.findOne({ where: { id }, relations: { route: true } });
    if (!rule) throw new AppException('PRICE_NOT_FOUND', HttpStatus.NOT_FOUND);
    return rule;
  }

  async create(dto: CreatePricingDto) {
    if (!(await this.routes.exist({ where: { id: dto.routeId } })))
      throw new AppException('ROUTE_NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.segment(dto.routeId, dto.fromStopId, dto.toStopId);
    return this.rules.save(
      this.rules.create({
        ...dto,
        seatType: dto.seatType ?? null,
        currency: dto.currency ?? 'UZS',
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
      }),
    );
  }

  async update(id: string, dto: UpdatePricingDto) {
    const rule = await this.get(id);
    const from = dto.fromStopId ?? rule.fromStopId;
    const to = dto.toStopId ?? rule.toStopId;
    await this.segment(rule.routeId, from, to);
    Object.assign(rule, {
      fromStopId: from,
      toStopId: to,
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.seatType !== undefined ? { seatType: dto.seatType || null } : {}),
      ...(dto.currency ? { currency: dto.currency } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(dto.validFrom !== undefined ? { validFrom: dto.validFrom ? new Date(dto.validFrom) : null } : {}),
      ...(dto.validTo !== undefined ? { validTo: dto.validTo ? new Date(dto.validTo) : null } : {}),
    });
    delete (rule as any).fromStop;
    delete (rule as any).toStop;
    await this.rules.save(rule);
    return this.get(id);
  }

  async remove(id: string) {
    await this.get(id);
    await this.rules.delete(id);
    return { id };
  }
}
