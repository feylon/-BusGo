import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, RoleName } from '@bus/types';
import { Audit, AuthUser, CorrelationId, CurrentUser, RequirePermissions, Roles } from '../../common/decorators';
import { BookingsService, isStaff } from './bookings.service';
import { TripOpsService } from './trip-ops.service';
import { BookingQuery, CreateBookingDto } from './bookings.dto';
import { CancelDto, DelayTripDto } from '../trips/trips.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @RequirePermissions('bookings.create')
  @Audit(AuditAction.BOOKING_CREATED, 'booking')
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.bookings.create(dto, user, isStaff(user) ? 'OFFICE' : 'WEB', cid);
  }

  @Get('my')
  mine(@CurrentUser() user: AuthUser, @Query() q: BookingQuery) {
    return this.bookings.list(q, user.id);
  }

  @Get()
  @RequirePermissions('bookings.read')
  list(@Query() q: BookingQuery) {
    return this.bookings.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookings.get(id, user);
  }

  @Post(':id/cancel')
  @Audit(AuditAction.BOOKING_CANCELLED, 'booking')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() cid: string,
  ) {
    return this.bookings.cancel(id, user, dto.reason || (isStaff(user) ? 'CANCELLED_BY_STAFF' : 'CANCELLED_BY_PASSENGER'), {
      correlationId: cid,
    });
  }
}

@ApiTags('Trips')
@ApiBearerAuth()
@Controller('trips/:id')
export class TripOpsController {
  constructor(
    private readonly ops: TripOpsService,
    private readonly bookings: BookingsService,
  ) {}

  @Get('passengers')
  @Roles(RoleName.ADMIN, RoleName.DISPATCHER, RoleName.DRIVER)
  async passengers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.ops.assertDriverAccess(id, user);
    return this.bookings.passengers(id);
  }

  @Post('boarding')
  @RequirePermissions('trips.update')
  @Audit(AuditAction.TRIP_STATUS_CHANGED, 'trip')
  boarding(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.boarding(id);
  }

  @Post('start')
  @RequirePermissions('trips.update')
  @Audit(AuditAction.TRIP_STATUS_CHANGED, 'trip')
  start(@Param('id', ParseUUIDPipe) id: string, @CorrelationId() cid: string) {
    return this.ops.start(id, undefined, cid);
  }

  @Post('delay')
  @RequirePermissions('trips.update')
  @Audit(AuditAction.TRIP_STATUS_CHANGED, 'trip')
  delay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DelayTripDto, @CorrelationId() cid: string) {
    return this.ops.delay(id, dto.minutes, dto.reason, cid);
  }

  @Post('complete')
  @RequirePermissions('trips.update')
  @Audit(AuditAction.TRIP_STATUS_CHANGED, 'trip')
  complete(@Param('id', ParseUUIDPipe) id: string, @CorrelationId() cid: string) {
    return this.ops.complete(id, undefined, cid);
  }

  @Post('cancel')
  @RequirePermissions('trips.cancel')
  @Audit(AuditAction.TRIP_CANCELLED, 'trip')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto, @CorrelationId() cid: string) {
    return this.ops.cancel(id, dto.reason, cid);
  }
}
