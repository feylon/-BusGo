import { Body, Controller, Delete, Get, HttpStatus, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsBoolean, IsLatitude, IsLongitude, IsOptional, IsString, Length } from 'class-validator';
import { Repository } from 'typeorm';
import { AuditAction } from '@bus/types';
import { AppException, paginate } from '@bus/shared';
import { Stop } from './stop.entity';
import { RouteStop } from '../routes/route-stop.entity';
import { Audit, Public, RequirePermissions } from '../../common/decorators';
import { PageQuery, pageResult } from '../../common/dto';

export class CreateStopDto {
  @ApiProperty({ example: 'Toshkent Avtovokzali' })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ example: 'Toshkent' })
  @IsString()
  @Length(2, 100)
  city: string;

  @ApiPropertyOptional({ example: 'Toshkent shahri' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 41.2995 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 69.2401 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateStopDto extends PartialType(CreateStopDto) {}

export class StopQuery extends PageQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;
}

@Injectable()
export class StopsService {
  constructor(
    @InjectRepository(Stop) private readonly stops: Repository<Stop>,
    @InjectRepository(RouteStop) private readonly routeStops: Repository<RouteStop>,
  ) {}

  async list(q: StopQuery) {
    const { page, limit, skip } = paginate(q, 500);
    const qb = this.stops.createQueryBuilder('s').orderBy('s.city', 'ASC').addOrderBy('s.name', 'ASC').skip(skip).take(limit);
    if (q.city) qb.andWhere('s.city ILIKE :city', { city: q.city });
    if (q.search) qb.andWhere('(s.name ILIKE :s OR s.city ILIKE :s OR s.region ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return pageResult(items, total, page, limit);
  }

  async cities() {
    const rows = await this.stops
      .createQueryBuilder('s')
      .select('s.city', 'city')
      .addSelect('COUNT(*)::int', 'stops')
      .where('s.active = true')
      .groupBy('s.city')
      .orderBy('s.city')
      .getRawMany();
    return rows;
  }

  async get(id: string) {
    const stop = await this.stops.findOne({ where: { id } });
    if (!stop) throw new AppException('STOP_NOT_FOUND', HttpStatus.NOT_FOUND);
    return stop;
  }

  create(dto: CreateStopDto) {
    return this.stops.save(this.stops.create(dto));
  }

  async update(id: string, dto: UpdateStopDto) {
    const stop = await this.get(id);
    return this.stops.save(Object.assign(stop, dto));
  }

  async remove(id: string) {
    const stop = await this.get(id);
    if (await this.routeStops.exist({ where: { stopId: id } })) throw new AppException('STOP_IN_USE', HttpStatus.CONFLICT);
    await this.stops.remove(stop);
    return { id };
  }
}

@ApiTags('Stops')
@Controller('stops')
export class StopsController {
  constructor(private readonly stops: StopsService) {}

  @Public()
  @Get()
  list(@Query() q: StopQuery) {
    return this.stops.list(q);
  }

  @Public()
  @Get('cities')
  cities() {
    return this.stops.cities();
  }

  @Public()
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.stops.get(id);
  }

  @ApiBearerAuth()
  @Post()
  @RequirePermissions('stops.manage')
  @Audit(AuditAction.STOP_CREATED, 'stop')
  create(@Body() dto: CreateStopDto) {
    return this.stops.create(dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @RequirePermissions('stops.manage')
  @Audit(AuditAction.STOP_UPDATED, 'stop')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStopDto) {
    return this.stops.update(id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @RequirePermissions('stops.manage')
  @Audit(AuditAction.STOP_DELETED, 'stop')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.stops.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Stop, RouteStop])],
  providers: [StopsService],
  controllers: [StopsController],
  exports: [StopsService],
})
export class StopsModule {}
