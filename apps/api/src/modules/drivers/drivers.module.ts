import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from './driver.entity';
import { Trip } from '../trips/trip.entity';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, Trip])],
  providers: [DriversService],
  controllers: [DriversController],
  exports: [DriversService],
})
export class DriversModule {}
