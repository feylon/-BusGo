import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { BookingItem } from './booking-item.entity';
import { TripSeat } from '../trips/trip-seat.entity';
import { Trip } from '../trips/trip.entity';
import { TripsModule } from '../trips/trips.module';
import { PricingModule } from '../pricing/pricing.module';
import { SettingsModule } from '../settings/settings.module';
import { TicketsModule } from '../tickets/tickets.module';
import { BookingsService } from './bookings.service';
import { TripOpsService } from './trip-ops.service';
import { BookingsController, TripOpsController } from './bookings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingItem, TripSeat, Trip]),
    TripsModule,
    PricingModule,
    SettingsModule,
    TicketsModule,
  ],
  providers: [BookingsService, TripOpsService],
  controllers: [BookingsController, TripOpsController],
  exports: [BookingsService, TripOpsService],
})
export class BookingsModule {}
