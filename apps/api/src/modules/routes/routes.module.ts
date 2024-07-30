import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from './route.entity';
import { RouteStop } from './route-stop.entity';
import { Stop } from '../stops/stop.entity';
import { Trip } from '../trips/trip.entity';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Route, RouteStop, Stop, Trip])],
  providers: [RoutesService],
  controllers: [RoutesController],
  exports: [RoutesService],
})
export class RoutesModule {}
