import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TripStatus, VehicleLocation } from '@bus/types';
import { AppException } from '@bus/shared';
import { TripsModule } from '../trips/trips.module';
import { TripsService } from '../trips/trips.service';
import { ClientsService } from '../../common/clients.service';
import { AuthUser, CorrelationId, CurrentUser, Public, RequirePermissions } from '../../common/decorators';

const TRACKABLE = [TripStatus.BOARDING, TripStatus.IN_PROGRESS, TripStatus.DELAYED];

export class LocationDto {
  @ApiProperty()
  @IsUUID()
  tripId: string;

  @ApiProperty({ example: 41.2995 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 69.2401 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 72, description: 'km/h' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(250)
  speed?: number;

  @ApiPropertyOptional({ example: 240 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  timestamp?: string;
}

export class HistoryQuery {
  @ApiPropertyOptional({ default: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}

@Injectable()
export class TrackingService {
  constructor(
    private readonly trips: TripsService,
    private readonly clients: ClientsService,
  ) {}

  async push(dto: LocationDto, user: AuthUser, correlationId?: string) {
    if (!user.driverId) throw new AppException('DRIVER_NOT_ASSIGNED', HttpStatus.FORBIDDEN);
    const info = await this.trips.cachedInfo(dto.tripId);
    if (!info) throw new AppException('TRIP_NOT_FOUND', HttpStatus.NOT_FOUND);
    if (info.driverId !== user.driverId) throw new AppException('DRIVER_NOT_ASSIGNED', HttpStatus.FORBIDDEN);
    if (!TRACKABLE.includes(info.status)) throw new AppException('TRACKING_NOT_ALLOWED', HttpStatus.CONFLICT);
    return this.clients.tracking.post<VehicleLocation>(
      '/locations',
      {
        tripId: dto.tripId,
        vehicleId: info.busId,
        driverId: user.driverId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        speed: dto.speed ?? 0,
        heading: dto.heading ?? 0,
        accuracy: dto.accuracy ?? 0,
        timestamp: dto.timestamp ?? new Date().toISOString(),
        tripStatus: info.status,
        destination: info.destination,
      },
      { correlationId },
    );
  }

  async current(tripId: string) {
    const trip = await this.trips.get(tripId);
    const location = await this.clients.tracking
      .get<VehicleLocation | null>(`/locations/trips/${tripId}`)
      .catch(() => null);
    return {
      trip: {
        id: trip.id,
        status: trip.status,
        departureAt: trip.departureAt,
        arrivalAt: trip.arrivalAt,
        delayMinutes: trip.delayMinutes,
        route: { id: trip.route?.id, name: trip.route?.name },
        bus: trip.bus ? { id: trip.bus.id, name: trip.bus.name, plateNumber: trip.bus.plateNumber } : null,
        stops: (trip.route?.stops ?? []).map((s) => ({
          id: s.stopId,
          order: s.order,
          name: s.stop?.name,
          city: s.stop?.city,
          latitude: s.stop?.latitude,
          longitude: s.stop?.longitude,
          arrivalAt: new Date(trip.departureAt.getTime() + (s.arrivalOffsetMin + trip.delayMinutes) * 60000),
        })),
      },
      location,
    };
  }

  history(tripId: string, limit = 500) {
    return this.clients.tracking.get(`/locations/trips/${tripId}/history`, { params: { limit } });
  }

  async vehicles() {
    const active = await this.trips.active();
    const locations = await this.clients.tracking
      .post<VehicleLocation[]>('/locations/batch', { tripIds: active.map((t) => t.id) })
      .catch(() => [] as VehicleLocation[]);
    return active.map((t) => ({
      tripId: t.id,
      status: t.status,
      departureAt: t.departureAt,
      arrivalAt: t.arrivalAt,
      delayMinutes: t.delayMinutes,
      route: { id: t.route?.id, name: t.route?.name },
      bus: t.bus ? { id: t.bus.id, name: t.bus.name, plateNumber: t.bus.plateNumber } : null,
      driver: t.driver ? { id: t.driver.id, fullName: t.driver.user?.fullName, phone: t.driver.user?.phone } : null,
      stops: (t.route?.stops ?? [])
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ name: s.stop?.name, latitude: s.stop?.latitude, longitude: s.stop?.longitude })),
      location: locations.find((l) => l.tripId === t.id) ?? null,
    }));
  }
}

@ApiTags('Tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @ApiBearerAuth()
  @Post('location')
  @HttpCode(200)
  @RequirePermissions('tracking.send')
  push(@Body() dto: LocationDto, @CurrentUser() user: AuthUser, @CorrelationId() cid: string) {
    return this.tracking.push(dto, user, cid);
  }

  @ApiBearerAuth()
  @Get('vehicles')
  @RequirePermissions('tracking.read', 'trips.update')
  vehicles() {
    return this.tracking.vehicles();
  }

  @Public()
  @Get(':tripId')
  current(@Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.tracking.current(tripId);
  }

  @ApiBearerAuth()
  @Get(':tripId/history')
  @RequirePermissions('tracking.read')
  history(@Param('tripId', ParseUUIDPipe) tripId: string, @Query() q: HistoryQuery) {
    return this.tracking.history(tripId, q.limit);
  }
}

@Module({
  imports: [TripsModule],
  providers: [TrackingService],
  controllers: [TrackingController],
  exports: [TrackingService],
})
export class TrackingModule {}
