import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from './trip.entity';
import { TripSeat } from './trip-seat.entity';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';
import { BusSeat } from '../buses/bus-seat.entity';
import { Driver } from '../drivers/driver.entity';
import { Booking } from '../bookings/booking.entity';
import { PricingModule } from '../pricing/pricing.module';
import { SettingsModule } from '../settings/settings.module';
import { TripsService } from './trips.service';
import { SeatLockService } from './seat-lock.service';
import { TripsController } from './trips.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripSeat, Route, Bus, BusSeat, Driver, Booking]), PricingModule, SettingsModule],
  providers: [TripsService, SeatLockService],
  controllers: [TripsController],
  exports: [TripsService, SeatLockService],
})
export class TripsModule {}
