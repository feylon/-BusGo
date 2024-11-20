import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceBus } from '@bus/shared';
import { dataSourceOptions } from './data-source';
import { DailySummary, ReportBooking, ReportPayment, ReportTrip } from './read-model.entity';
import { ProjectorService } from './projector.service';
import { ReportsService } from './reports.service';
import { AppController, ReportsController } from './app.controller';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...dataSourceOptions(), migrationsRun: true }) }),
    TypeOrmModule.forFeature([ReportBooking, ReportTrip, ReportPayment, DailySummary]),
  ],
  controllers: [AppController, ReportsController],
  providers: [ProjectorService, ReportsService, { provide: ServiceBus, useFactory: () => new ServiceBus('reporting') }],
})
export class AppModule {}
