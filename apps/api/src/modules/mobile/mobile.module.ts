import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditAction, RoleName } from '@bus/types';
import { Audit, AuthUser, CorrelationId, CurrentUser, Public, RequirePermissions, Roles } from '../../common/decorators';
import { AuditService } from '../../common/audit.service';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { OtpService } from '../auth/otp.service';
import { RefreshDto, SendOtpDto, VerifyOtpDto } from '../auth/auth.dto';
import { RoutesModule } from '../routes/routes.module';
import { RoutesService } from '../routes/routes.service';
import { RouteQuery } from '../routes/routes.dto';
import { TripsModule } from '../trips/trips.module';
import { TripsService } from '../trips/trips.service';
import { SeatLockService } from '../trips/seat-lock.service';
import { SegmentQuery, TripSearchQuery, CancelDto } from '../trips/trips.dto';
import { BookingsModule } from '../bookings/bookings.module';
import { BookingsService } from '../bookings/bookings.service';
import { TripOpsService } from '../bookings/trip-ops.service';
import { BookingQuery, CreateBookingDto, PayBookingDto } from '../bookings/bookings.dto';
import { PaymentsModule, PaymentsService, MockCompleteDto } from '../payments/payments.module';
import { TicketsModule } from '../tickets/tickets.module';
import { TicketsService } from '../tickets/tickets.service';
import { TicketQuery, VerifyTicketDto } from '../tickets/tickets.controller';
import { NotificationsModule, NotificationsService, NotificationQuery } from '../notifications/notifications.module';
import { TrackingModule, TrackingService, LocationDto } from '../tracking/tracking.module';

@ApiTags('Mobile API')
@Controller('mobile')
export class MobileController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
    private readonly routes: RoutesService,
    private readonly trips: TripsService,
    private readonly locks: SeatLockService,
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
    private readonly tickets: TicketsService,
    private readonly notifications: NotificationsService,
    private readonly tracking: TrackingService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('auth/send-otp')
  @HttpCode(200)
  sendOtp(@Body() dto: SendOtpDto, @CorrelationId() cid: string) {
    return this.otp.send(this.auth.phoneOrFail(dto.phone), dto.purpose ?? 'LOGIN', cid);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('auth/verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @CorrelationId() cid: string, @Req() req: any) {
    const result = await this.auth.loginWithOtp(dto, cid);
    this.audit.fromRequest(req, {
      action: result.created ? AuditAction.USER_REGISTERED : AuditAction.USER_LOGIN,
      entity: 'user',
      entityId: result.user.id,
      userId: result.user.id,
      userRole: result.user.roles[0],
      metadata: { method: 'otp', channel: 'mobile' },
    });
    return result;
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get('auth/me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.profile(user.id);
  }

  @Public()
  @Get('routes')
  routesList(@Query() q: RouteQuery) {
    return this.routes.list(q, true);
  }

  @Public()
  @Get('trips')
  search(@Query() q: TripSearchQuery) {
    return this.trips.search(q);
  }

  @Public()
  @Get('trips/:id')
  trip(@Param('id', ParseUUIDPipe) id: string) {
    return this.trips.details(id);
  }

  @Public()
  @Get('trips/:id/seats')
  seats(@Param('id', ParseUUIDPipe) id: string, @Query() q: SegmentQuery, @CurrentUser() user?: AuthUser) {
    return this.trips.seatMap(id, user?.id ?? null, q.fromStopId, q.toStopId);
  }

  @ApiBearerAuth()
  @Post('trips/:id/seats/:seatId/lock')
  @RequirePermissions('bookings.create')
  lock(@Param('id', ParseUUIDPipe) id: string, @Param('seatId', ParseUUIDPipe) seatId: string, @CurrentUser() user: AuthUser) {
    return this.locks.lock(id, seatId, user.id);
  }

  @ApiBearerAuth()
  @Delete('trips/:id/seats/:seatId/lock')
  @RequirePermissions('bookings.create')
  unlock(@Param('id', ParseUUIDPipe) id: string, @Param('seatId', ParseUUIDPipe) seatId: string, @CurrentUser() user: AuthUser) {
    return this.locks.unlock(id, seatId, user.id);
  }

  @ApiBearerAuth()
  @Post('bookings')
  @RequirePermissions('bookings.create')
  @Audit(AuditAction.BOOKING_CREATED, 'booking')
  createBooking(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.bookings.create(dto, user, 'MOBILE', cid);
  }

  @ApiBearerAuth()
  @Get('bookings')
  myBookings(@CurrentUser() user: AuthUser, @Query() q: BookingQuery) {
    return this.bookings.list(q, user.id);
  }

  @ApiBearerAuth()
  @Get('bookings/:id')
  booking(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookings.get(id, user);
  }

  @ApiBearerAuth()
  @Post('bookings/:id/cancel')
  @Audit(AuditAction.BOOKING_CANCELLED, 'booking')
  cancelBooking(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.bookings.cancel(id, user, dto.reason || 'CANCELLED_BY_PASSENGER', { correlationId: cid });
  }

  @ApiBearerAuth()
  @Post('bookings/:id/pay')
  @Audit(AuditAction.PAYMENT_CREATED, 'booking')
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayBookingDto, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.payments.initiate(id, user, dto.provider ?? 'mock', cid);
  }

  @ApiBearerAuth()
  @Post('payments/:id/mock/complete')
  @Audit(AuditAction.PAYMENT_SUCCEEDED, 'payment')
  completePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MockCompleteDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() cid: string,
  ) {
    return this.payments.mockComplete(id, dto.success, user, cid);
  }

  @ApiBearerAuth()
  @Get('tickets')
  myTickets(@CurrentUser() user: AuthUser, @Query() q: TicketQuery) {
    return this.tickets.mine(user.id, q);
  }

  @ApiBearerAuth()
  @Get('tickets/:id')
  ticket(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.get(id, user);
  }

  @ApiBearerAuth()
  @Get('notifications')
  notificationsList(@CurrentUser() user: AuthUser, @Query() q: NotificationQuery) {
    return this.notifications.list(user.id, q);
  }

  @ApiBearerAuth()
  @Get('notifications/unread-count')
  unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @ApiBearerAuth()
  @Patch('notifications/:id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.read(user.id, id);
  }

  @Public()
  @Get('tracking/:tripId')
  trackTrip(@Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.tracking.current(tripId);
  }
}

@ApiTags('Mobile API')
@ApiBearerAuth()
@Roles(RoleName.DRIVER)
@Controller('mobile/driver')
export class MobileDriverController {
  constructor(
    private readonly ops: TripOpsService,
    private readonly bookings: BookingsService,
    private readonly tickets: TicketsService,
    private readonly tracking: TrackingService,
  ) {}

  @Get('trips')
  trips(@CurrentUser() user: AuthUser, @Query('scope') scope: 'today' | 'upcoming' | 'history' = 'today') {
    return this.ops.driverTrips(user.driverId ?? '00000000-0000-0000-0000-000000000000', scope);
  }

  @Get('trips/:id/passengers')
  async passengers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.ops.assertDriverAccess(id, user);
    return this.bookings.passengers(id);
  }

  @Post('location')
  @HttpCode(200)
  location(@Body() dto: LocationDto, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.tracking.push(dto, user, cid);
  }

  @Post('trips/:id/start')
  @Audit(AuditAction.TRIP_STATUS_CHANGED, 'trip')
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.ops.start(id, user, cid);
  }

  @Post('trips/:id/finish')
  @Audit(AuditAction.TRIP_STATUS_CHANGED, 'trip')
  finish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.ops.complete(id, user, cid);
  }

  @Post('tickets/verify')
  @HttpCode(200)
  verify(@Body() dto: VerifyTicketDto, @CurrentUser() user: AuthUser, @Req() req: any) {
    return this.tickets.verify(dto.token, user, dto.tripId, req);
  }
}

@ApiTags('Drivers')
@ApiBearerAuth()
@Roles(RoleName.DRIVER)
@Controller('driver')
export class DriverPortalController {
  constructor(
    private readonly ops: TripOpsService,
    private readonly bookings: BookingsService,
  ) {}

  @Get('trips')
  trips(@CurrentUser() user: AuthUser, @Query('scope') scope: 'today' | 'upcoming' | 'history' = 'today') {
    return this.ops.driverTrips(user.driverId ?? '00000000-0000-0000-0000-000000000000', scope);
  }

  @Get('trips/:id/passengers')
  async passengers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.ops.assertDriverAccess(id, user);
    return this.bookings.passengers(id);
  }

  @Post('trips/:id/boarding')
  @Audit(AuditAction.TRIP_STATUS_CHANGED, 'trip')
  boarding(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ops.boarding(id, user);
  }

  @Post('trips/:id/start')
  @Audit(AuditAction.TRIP_STATUS_CHANGED, 'trip')
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.ops.start(id, user, cid);
  }

  @Post('trips/:id/finish')
  @Audit(AuditAction.TRIP_STATUS_CHANGED, 'trip')
  finish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.ops.complete(id, user, cid);
  }
}

@Module({
  imports: [AuthModule, RoutesModule, TripsModule, BookingsModule, PaymentsModule, TicketsModule, NotificationsModule, TrackingModule],
  controllers: [MobileController, MobileDriverController, DriverPortalController],
})
export class MobileModule {}
