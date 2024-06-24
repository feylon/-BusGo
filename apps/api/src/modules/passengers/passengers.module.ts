import { Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException, paginate } from '@bus/shared';
import { Passenger } from './passenger.entity';
import { AuthUser, CurrentUser, RequirePermissions } from '../../common/decorators';
import { PageQuery, pageResult } from '../../common/dto';

@Injectable()
export class PassengersService {
  constructor(@InjectRepository(Passenger) private readonly passengers: Repository<Passenger>) {}

  async list(q: PageQuery) {
    const { page, limit, skip } = paginate(q);
    const qb = this.passengers.createQueryBuilder('p').orderBy('p.createdAt', 'DESC').skip(skip).take(limit);
    if (q.search)
      qb.where('(p.fullName ILIKE :s OR p.phone ILIKE :s OR p.documentNumber ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return pageResult(items, total, page, limit);
  }

  async get(id: string) {
    const p = await this.passengers.findOne({ where: { id } });
    if (!p) throw new AppException('NOT_FOUND', 404);
    return p;
  }

  async mine(userId: string) {
    const rows = await this.passengers.find({ where: { userId }, order: { createdAt: 'DESC' } });
    const seen = new Set<string>();
    return rows.filter((p) => {
      const key = `${p.fullName.toLowerCase()}|${p.documentNumber ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

@ApiTags('Passengers')
@ApiBearerAuth()
@Controller('passengers')
export class PassengersController {
  constructor(private readonly passengers: PassengersService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.passengers.mine(user.id);
  }

  @Get()
  @RequirePermissions('passengers.read')
  list(@Query() q: PageQuery) {
    return this.passengers.list(q);
  }

  @Get(':id')
  @RequirePermissions('passengers.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.passengers.get(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Passenger])],
  providers: [PassengersService],
  controllers: [PassengersController],
  exports: [PassengersService],
})
export class PassengersModule {}
