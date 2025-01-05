import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@bus/types';
import { Audit, RequirePermissions } from '../../common/decorators';
import { DriversService } from './drivers.service';
import { CreateDriverDto, DriverQuery, UpdateDriverDto } from './drivers.dto';

@ApiTags('Drivers')
@ApiBearerAuth()
@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  @RequirePermissions('drivers.read')
  list(@Query() q: DriverQuery) {
    return this.drivers.list(q);
  }

  @Get(':id')
  @RequirePermissions('drivers.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.drivers.details(id);
  }

  @Post()
  @RequirePermissions('drivers.manage')
  @Audit(AuditAction.DRIVER_CREATED, 'driver')
  create(@Body() dto: CreateDriverDto) {
    return this.drivers.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('drivers.manage')
  @Audit(AuditAction.DRIVER_UPDATED, 'driver')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDriverDto) {
    return this.drivers.update(id, dto);
  }
}
