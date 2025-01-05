import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditAction } from '@bus/types';
import { PricingRule } from './pricing-rule.entity';
import { RouteStop } from '../routes/route-stop.entity';
import { Route } from '../routes/route.entity';
import { PricingService } from './pricing.service';
import { CreatePricingDto, PricingQuery, UpdatePricingDto } from './pricing.dto';
import { Audit, RequirePermissions } from '../../common/decorators';
import { SettingsModule } from '../settings/settings.module';

@ApiTags('Pricing')
@ApiBearerAuth()
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  @RequirePermissions('pricing.read')
  list(@Query() q: PricingQuery) {
    return this.pricing.list(q);
  }

  @Get(':id')
  @RequirePermissions('pricing.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.get(id);
  }

  @Post()
  @RequirePermissions('pricing.manage')
  @Audit(AuditAction.PRICE_CREATED, 'pricing_rule')
  create(@Body() dto: CreatePricingDto) {
    return this.pricing.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('pricing.manage')
  @Audit(AuditAction.PRICE_UPDATED, 'pricing_rule')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePricingDto) {
    return this.pricing.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('pricing.manage')
  @Audit(AuditAction.PRICE_DELETED, 'pricing_rule')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule, RouteStop, Route]), SettingsModule],
  providers: [PricingService],
  controllers: [PricingController],
  exports: [PricingService],
})
export class PricingModule {}
