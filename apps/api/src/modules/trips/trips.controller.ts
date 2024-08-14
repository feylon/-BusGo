import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@bus/types';
import { Audit, AuthUser, CorrelationId, CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { TripsService } from './trips.service';
import { SeatLockService } from './seat-lock.service';
import {
  AssignDriverDto,
  CreateTripDto,
  GenerateTripsDto,
  SegmentQuery,
  TripQuery,
  TripSearchQuery,
  UpdateTripDto,
} from './trips.dto';

@ApiTags('Trips')
@Controller('trips')
export class TripsController {
  constructor(
    private readonly trips: TripsService,
    private readonly locks: SeatLockService,
  ) {}

  @Public()
  @Get('search')
  search(@Query() q: TripSearchQuery) {
    return this.trips.search(q);
  }

  @ApiBearerAuth()
  @Get()
  @RequirePermissions('trips.read')
  list(@Query() q: TripQuery) {
    return this.trips.list(q);
  }

  @Public()
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.trips.details(id);
  }

  @Public()
  @Get(':id/seats')
  seats(@Param('id', ParseUUIDPipe) id: string, @Query() q: SegmentQuery, @CurrentUser() user?: AuthUser) {
    return this.trips.seatMap(id, user?.id ?? null, q.fromStopId, q.toStopId);
  }

  @ApiBearerAuth()
  @Post(':id/seats/:seatId/lock')
  @RequirePermissions('bookings.create')
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('seatId', ParseUUIDPipe) seatId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.locks.lock(id, seatId, user.id);
  }

  @ApiBearerAuth()
  @Delete(':id/seats/:seatId/lock')
  @RequirePermissions('bookings.create')
  unlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('seatId', ParseUUIDPipe) seatId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.locks.unlock(id, seatId, user.id);
  }

  @ApiBearerAuth()
  @Delete(':id/locks')
  @RequirePermissions('bookings.create')
  unlockAll(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.locks.unlockAll(id, user.id);
  }

  @ApiBearerAuth()
  @Post()
  @RequirePermissions('trips.create')
  @Audit(AuditAction.TRIP_CREATED, 'trip')
  create(@Body() dto: CreateTripDto, @CorrelationId() cid: string) {
    return this.trips.create(dto, cid);
  }

  @ApiBearerAuth()
  @Post('generate')
  @RequirePermissions('trips.create')
  @Audit(AuditAction.TRIP_CREATED, 'trip')
  generate(@Body() dto: GenerateTripsDto, @CorrelationId() cid: string) {
    return this.trips.generate(dto, cid);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @RequirePermissions('trips.update')
  @Audit(AuditAction.TRIP_UPDATED, 'trip')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTripDto) {
    return this.trips.update(id, dto);
  }

  @ApiBearerAuth()
  @Patch(':id/driver')
  @RequirePermissions('trips.update')
  @Audit(AuditAction.DRIVER_ASSIGNED, 'trip')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDriverDto) {
    return this.trips.assignDriver(id, dto.driverId);
  }
}
