import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsLatitude, IsLongitude, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { InternalTokenGuard, ServiceBus, runHealthChecks } from '@bus/shared';
import { REDIS, TrackingService } from './tracking.service';

class LocationBody {
  @IsUUID()
  tripId: string;

  @IsUUID()
  vehicleId: string;

  @IsUUID()
  driverId: string;

  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsNumber()
  speed: number;

  @IsOptional()
  @IsNumber()
  heading: number;

  @IsOptional()
  @IsNumber()
  accuracy: number;

  @IsDateString()
  timestamp: string;

  @IsOptional()
  @IsString()
  tripStatus?: string;

  @IsOptional()
  @IsObject()
  destination?: { lat: number; lng: number } | null;
}

class BatchBody {
  @IsArray()
  @IsUUID('all', { each: true })
  tripIds: string[];
}

@Controller()
export class AppController {
  constructor(
    private readonly tracking: TrackingService,
    private readonly ds: DataSource,
    private readonly bus: ServiceBus,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('health')
  async health(@Res() res: any) {
    const { ok, body } = await runHealthChecks({
      database: async () => !!(await this.ds.query('SELECT 1')),
      redis: async () => (await this.redis.ping()) === 'PONG',
      rabbitmq: () => this.bus.connected,
    });
    res.status(ok ? 200 : 503).json(body);
  }

  @UseGuards(InternalTokenGuard)
  @Post('locations')
  @HttpCode(200)
  record(@Body() body: LocationBody) {
    return this.tracking.record(body);
  }

  @UseGuards(InternalTokenGuard)
  @Post('locations/batch')
  @HttpCode(200)
  batch(@Body() body: BatchBody) {
    return this.tracking.batch(body.tripIds);
  }

  @UseGuards(InternalTokenGuard)
  @Get('locations/active')
  active() {
    return this.tracking.active();
  }

  @UseGuards(InternalTokenGuard)
  @Get('locations/trips/:tripId')
  current(@Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.tracking.current(tripId);
  }

  @UseGuards(InternalTokenGuard)
  @Get('locations/trips/:tripId/history')
  history(@Param('tripId', ParseUUIDPipe) tripId: string, @Query('limit') limit?: string) {
    return this.tracking.trail(tripId, Number(limit) || 500);
  }

  @UseGuards(InternalTokenGuard)
  @Post('jobs/cleanup')
  @HttpCode(200)
  cleanup() {
    return this.tracking.cleanup();
  }
}
