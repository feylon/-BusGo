import { Body, Controller, Delete, Get, HttpStatus, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Repository } from 'typeorm';
import { AuditAction, ResponsibleEntity } from '@bus/types';
import { AppException, normalizePhone, paginate } from '@bus/shared';
import { Responsible } from './responsible.entity';
import { Audit, RequirePermissions } from '../../common/decorators';
import { PageQuery, pageResult } from '../../common/dto';

export class CreateResponsibleDto {
  @ApiProperty()
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Navbatchi dispetcher' })
  @IsString()
  @Length(2, 100)
  role: string;

  @ApiPropertyOptional({ example: 'Samarqand viloyati' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ enum: ResponsibleEntity })
  @IsEnum(ResponsibleEntity)
  entityType: ResponsibleEntity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class UpdateResponsibleDto extends PartialType(CreateResponsibleDto) {}

export class ResponsibleQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ResponsibleEntity })
  @IsOptional()
  @IsEnum(ResponsibleEntity)
  entityType?: ResponsibleEntity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;
}

@Injectable()
export class ResponsiblesService {
  constructor(@InjectRepository(Responsible) private readonly repo: Repository<Responsible>) {}

  async list(q: ResponsibleQuery) {
    const { page, limit, skip } = paginate(q);
    const qb = this.repo.createQueryBuilder('r').orderBy('r.name', 'ASC').skip(skip).take(limit);
    if (q.entityType) qb.andWhere('r.entityType = :t', { t: q.entityType });
    if (q.entityId) qb.andWhere('r.entityId = :id', { id: q.entityId });
    if (q.search) qb.andWhere('(r.name ILIKE :s OR r.phone ILIKE :s OR r.region ILIKE :s OR r.role ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return pageResult(items, total, page, limit);
  }

  async get(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new AppException('RESPONSIBLE_NOT_FOUND', HttpStatus.NOT_FOUND);
    return r;
  }

  private phone(raw?: string) {
    if (raw === undefined) return undefined;
    const p = normalizePhone(raw);
    if (!p) throw new AppException('INVALID_PHONE');
    return p;
  }

  create(dto: CreateResponsibleDto) {
    return this.repo.save(this.repo.create({ ...dto, phone: this.phone(dto.phone), entityId: dto.entityId ?? null }));
  }

  async update(id: string, dto: UpdateResponsibleDto) {
    const r = await this.get(id);
    return this.repo.save(Object.assign(r, { ...dto, ...(dto.phone ? { phone: this.phone(dto.phone) } : {}) }));
  }

  async remove(id: string) {
    await this.repo.remove(await this.get(id));
    return { id };
  }
}

@ApiTags('Responsibles')
@ApiBearerAuth()
@Controller('responsibles')
export class ResponsiblesController {
  constructor(private readonly service: ResponsiblesService) {}

  @Get()
  @RequirePermissions('responsibles.read')
  list(@Query() q: ResponsibleQuery) {
    return this.service.list(q);
  }

  @Get(':id')
  @RequirePermissions('responsibles.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('responsibles.manage')
  @Audit(AuditAction.RESPONSIBLE_CREATED, 'responsible')
  create(@Body() dto: CreateResponsibleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('responsibles.manage')
  @Audit(AuditAction.RESPONSIBLE_UPDATED, 'responsible')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResponsibleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('responsibles.manage')
  @Audit(AuditAction.RESPONSIBLE_DELETED, 'responsible')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Responsible])],
  providers: [ResponsiblesService],
  controllers: [ResponsiblesController],
})
export class ResponsiblesModule {}
