import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bus } from './bus.entity';
import { BusSeat } from './bus-seat.entity';
import { Trip } from '../trips/trip.entity';
import { BusesService } from './buses.service';
import { BusesController, SeatsController } from './buses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Bus, BusSeat, Trip])],
  providers: [BusesService],
  controllers: [BusesController, SeatsController],
  exports: [BusesService],
})
export class BusesModule {}
