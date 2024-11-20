import { Controller, HttpCode, Logger, Module, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalTokenGuard } from '@bus/shared';
import { Public } from '../../common/decorators';
import { BookingsModule } from '../bookings/bookings.module';
import { TripsModule } from '../trips/trips.module';
import { BookingsService } from '../bookings/bookings.service';
import { TripOpsService } from '../bookings/trip-ops.service';
import { SeatLockService } from '../trips/seat-lock.service';

@ApiExcludeController()
@Public()
@UseGuards(InternalTokenGuard)
@Controller('internal')
export class InternalController {
  private readonly logger = new Logger('InternalJobs');

  constructor(
    private readonly bookings: BookingsService,
    private readonly ops: TripOpsService,
    private readonly locks: SeatLockService,
  ) {}

  @Post('jobs/:name')
  @HttpCode(200)
  async run(@Param('name') name: string) {
    const jobs: Record<string, () => Promise<unknown>> = {
      'seat-lock-expiration': () => this.locks.releaseExpired(),
      'booking-expiration': () => this.bookings.expirePending(),
      'trip-reminder': () => this.ops.sendReminders(),
      'trip-status-update': () => this.ops.autoStatus(),
      'delayed-trip-check': () => this.ops.checkDelays(),
    };
    const job = jobs[name];
    if (!job) throw new NotFoundException();
    const started = Date.now();
    const result = await job();
    this.logger.debug(`${name} done in ${Date.now() - started}ms: ${JSON.stringify(result)}`);
    return { job: name, result, durationMs: Date.now() - started };
  }
}

@Module({
  imports: [BookingsModule, TripsModule],
  controllers: [InternalController],
})
export class InternalModule {}
