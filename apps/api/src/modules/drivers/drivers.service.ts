import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { RoleName, TripStatus } from '@bus/types';
import { AppException, normalizePhone, paginate } from '@bus/shared';
import { Driver } from './driver.entity';
import { User } from '../users/user.entity';
import { Role } from '../users/role.entity';
import { Trip } from '../trips/trip.entity';
import { RedisService } from '../../common/redis.service';
import { pageResult } from '../../common/dto';
import { CreateDriverDto, DriverQuery, UpdateDriverDto } from './drivers.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    private readonly ds: DataSource,
    private readonly redis: RedisService,
  ) {}

  async list(q: DriverQuery) {
    const { page, limit, skip } = paginate(q);
    const qb = this.drivers
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.user', 'u')
      .orderBy('u.fullName', 'ASC')
      .skip(skip)
      .take(limit);
    if (q.status) qb.andWhere('d.status = :status', { status: q.status });
    if (q.search)
      qb.andWhere('(u.fullName ILIKE :s OR u.phone ILIKE :s OR d.licenseNumber ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    const ids = items.map((d) => d.id);
    const current = ids.length
      ? await this.trips.find({
          where: { driverId: In(ids), status: In([TripStatus.BOARDING, TripStatus.IN_PROGRESS, TripStatus.DELAYED]) },
          relations: { route: true },
        })
      : [];
    return pageResult(
      items.map((d) => ({ ...this.view(d), currentTrip: current.find((t) => t.driverId === d.id) ?? null })),
      total,
      page,
      limit,
    );
  }

  view(d: Driver) {
    return {
      id: d.id,
      userId: d.userId,
      fullName: d.user?.fullName,
      phone: d.user?.phone,
      licenseNumber: d.licenseNumber,
      licenseCategory: d.licenseCategory,
      experienceYears: d.experienceYears,
      photoUrl: d.photoUrl,
      status: d.status,
      createdAt: d.createdAt,
    };
  }

  async get(id: string) {
    const driver = await this.drivers.findOne({ where: { id } });
    if (!driver) throw new AppException('DRIVER_NOT_FOUND', HttpStatus.NOT_FOUND);
    return driver;
  }

  async details(id: string) {
    const driver = await this.get(id);
    const trips = await this.trips.find({
      where: { driverId: id },
      relations: { route: true, bus: true },
      order: { departureAt: 'DESC' },
      take: 20,
    });
    return { ...this.view(driver), trips };
  }

  async create(dto: CreateDriverDto) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new AppException('INVALID_PHONE');
    return this.ds.transaction(async (m) => {
      if (await m.exists(User, { where: { phone } })) throw new AppException('USER_EXISTS', HttpStatus.CONFLICT);
      const role = await m.findOneByOrFail(Role, { name: RoleName.DRIVER });
      const user = await m.save(
        m.create(User, {
          phone,
          fullName: dto.fullName.trim(),
          passwordHash: await argon2.hash(dto.password),
          roles: [role],
        }),
      );
      const driver = await m.save(
        m.create(Driver, {
          userId: user.id,
          licenseNumber: dto.licenseNumber.toUpperCase(),
          licenseCategory: dto.licenseCategory ?? null,
          experienceYears: dto.experienceYears ?? 0,
          photoUrl: dto.photoUrl ?? null,
        }),
      );
      driver.user = user;
      return this.view(driver);
    });
  }

  async update(id: string, dto: UpdateDriverDto) {
    const driver = await this.get(id);
    if (dto.licenseNumber) driver.licenseNumber = dto.licenseNumber.toUpperCase();
    if (dto.licenseCategory !== undefined) driver.licenseCategory = dto.licenseCategory;
    if (dto.experienceYears !== undefined) driver.experienceYears = dto.experienceYears;
    if (dto.photoUrl !== undefined) driver.photoUrl = dto.photoUrl;
    if (dto.status) driver.status = dto.status;
    await this.drivers.save(driver);
    const patch: Partial<User> = {};
    if (dto.fullName) patch.fullName = dto.fullName.trim();
    if (dto.password) patch.passwordHash = await argon2.hash(dto.password);
    if (Object.keys(patch).length) await this.ds.getRepository(User).update(driver.userId, patch);
    await this.redis.client.del(`auth:user:${driver.userId}`);
    return this.view(await this.get(id));
  }
}
