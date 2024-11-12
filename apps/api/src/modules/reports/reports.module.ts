import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { DataSource } from 'typeorm';
import { BookingStatus, BusStatus, TripStatus } from '@bus/types';
import { ClientsService } from '../../common/clients.service';
import { RequirePermissions } from '../../common/decorators';

export class ReportQuery {
  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  routeId?: string;
}

const TZ = 'Asia/Tashkent';

@Injectable()
export class ReportsService {
  constructor(
    private readonly clients: ClientsService,
    private readonly ds: DataSource,
  ) {}

  get(path: string, q: ReportQuery) {
    return this.clients.reporting.get(`/reports/${path}`, { params: q });
  }

  async live() {
    const one = async (sql: string, params: unknown[] = []) => Number((await this.ds.query(sql, params))[0]?.count ?? 0);
    const [todayTrips, activeTrips, activeBuses, drivers, pendingBookings, todayBookings, todayRevenue, delayed] =
      await Promise.all([
        one(`SELECT COUNT(*) FROM trips WHERE ("departureAt" AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date`),
        one(`SELECT COUNT(*) FROM trips WHERE status = ANY($1)`, [[TripStatus.BOARDING, TripStatus.IN_PROGRESS, TripStatus.DELAYED]]),
        one(`SELECT COUNT(*) FROM buses WHERE status = $1`, [BusStatus.ACTIVE]),
        one(`SELECT COUNT(*) FROM drivers WHERE status = 'ACTIVE'`),
        one(`SELECT COUNT(*) FROM bookings WHERE status = $1`, [BookingStatus.PENDING]),
        one(
          `SELECT COUNT(*) FROM bookings WHERE status IN ('CONFIRMED','COMPLETED') AND ("confirmedAt" AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date`,
        ),
        one(
          `SELECT COALESCE(SUM("totalAmount"),0) AS count FROM bookings WHERE status IN ('CONFIRMED','COMPLETED') AND ("confirmedAt" AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date`,
        ),
        one(`SELECT COUNT(*) FROM trips WHERE status = $1`, [TripStatus.DELAYED]),
      ]);
    const upcoming = await this.ds.query(
      `SELECT t.id, t.status, t."departureAt", r.name AS route, b."plateNumber",
        (SELECT COUNT(*) FROM trip_seats s WHERE s."tripId" = t.id AND s.status = 'SOLD')::int AS sold,
        (SELECT COUNT(*) FROM trip_seats s WHERE s."tripId" = t.id AND s.status <> 'BLOCKED')::int AS total
       FROM trips t JOIN routes r ON r.id = t."routeId" JOIN buses b ON b.id = t."busId"
       WHERE t."departureAt" >= now() - interval '2 hours' AND t.status <> 'CANCELLED' AND t.status <> 'COMPLETED'
       ORDER BY t."departureAt" ASC LIMIT 8`,
    );
    return { todayTrips, activeTrips, activeBuses, drivers, pendingBookings, todayBookings, todayRevenue, delayed, upcoming };
  }
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@RequirePermissions('reports.read')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('live')
  live() {
    return this.reports.live();
  }

  @Get('dashboard')
  dashboard(@Query() q: ReportQuery) {
    return this.reports.get('dashboard', q);
  }

  @Get('sales')
  sales(@Query() q: ReportQuery) {
    return this.reports.get('sales', q);
  }

  @Get('routes')
  routes(@Query() q: ReportQuery) {
    return this.reports.get('routes', q);
  }

  @Get('buses')
  buses(@Query() q: ReportQuery) {
    return this.reports.get('buses', q);
  }

  @Get('drivers')
  drivers(@Query() q: ReportQuery) {
    return this.reports.get('drivers', q);
  }

  @Get('trips')
  trips(@Query() q: ReportQuery) {
    return this.reports.get('trips', q);
  }

  @Get('payments')
  payments(@Query() q: ReportQuery) {
    return this.reports.get('payments', q);
  }

  @Get('passengers')
  passengers(@Query() q: ReportQuery) {
    return this.reports.get('passengers', q);
  }

  @Get('cancellations')
  cancellations(@Query() q: ReportQuery) {
    return this.reports.get('cancellations', q);
  }

  @Get('daily')
  daily(@Query() q: ReportQuery) {
    return this.reports.get('daily', q);
  }
}

@Module({
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
