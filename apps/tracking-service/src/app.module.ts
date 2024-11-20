import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { ServiceBus } from '@bus/shared';
import { dataSourceOptions } from './data-source';
import { LocationHistory } from './location.entity';
import { REDIS, TrackingService } from './tracking.service';
import { AppController } from './app.controller';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...dataSourceOptions(), migrationsRun: true }) }),
    TypeOrmModule.forFeature([LocationHistory]),
  ],
  controllers: [AppController],
  providers: [
    TrackingService,
    { provide: ServiceBus, useFactory: () => new ServiceBus('tracking') },
    { provide: REDIS, useFactory: () => new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: 3 }) },
  ],
})
export class AppModule {}
