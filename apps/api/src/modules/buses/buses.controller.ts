import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@bus/types';
import { Audit, RequirePermissions } from '../../common/decorators';
import { BusesService } from './buses.service';
import { BusQuery, CreateBusDto, LayoutDto, UpdateBusDto, UpdateSeatDto } from './buses.dto';

@ApiTags('Buses')
@ApiBearerAuth()
@Controller('buses')
export class BusesController {
  constructor(private readonly buses: BusesService) {}

  @Get()
  @RequirePermissions('buses.read')
  list(@Query() q: BusQuery) {
    return this.buses.list(q);
  }

  @Get(':id')
  @RequirePermissions('buses.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.buses.details(id);
  }

  @Post()
  @RequirePermissions('buses.create')
  @Audit(AuditAction.BUS_CREATED, 'bus')
  create(@Body() dto: CreateBusDto) {
    return this.buses.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('buses.update')
  @Audit(AuditAction.BUS_UPDATED, 'bus')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBusDto) {
    return this.buses.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('buses.delete')
  @Audit(AuditAction.BUS_DELETED, 'bus')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.buses.remove(id);
  }
}

@ApiTags('Seats')
@ApiBearerAuth()
@Controller('buses/:id')
export class SeatsController {
  constructor(private readonly buses: BusesService) {}

  @Get('seats')
  @RequirePermissions('buses.read')
  async seats(@Param('id', ParseUUIDPipe) id: string) {
    const bus = await this.buses.details(id);
    return { layout: bus.layout, seats: bus.seats, capacity: bus.capacity };
  }

  @Put('layout')
  @RequirePermissions('buses.update')
  @Audit(AuditAction.SEAT_LAYOUT_UPDATED, 'bus')
  layout(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LayoutDto) {
    return this.buses.saveLayout(id, dto);
  }

  @Patch('seats/:seatId')
  @RequirePermissions('buses.update')
  @Audit(AuditAction.SEAT_BLOCKED, 'bus_seat')
  seat(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('seatId', ParseUUIDPipe) seatId: string,
    @Body() dto: UpdateSeatDto,
  ) {
    return this.buses.updateSeat(id, seatId, dto);
  }
}
