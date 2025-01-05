import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceBus } from '@bus/shared';
import { dataSourceOptions } from './data-source';
import { Notification } from './notification.entity';
import { Preference } from './preference.entity';
import { Delivery } from './delivery.entity';
import { NotificationsService } from './notifications.service';
import { AppController, NotificationsController } from './app.controller';
import { PUSH_PROVIDER, createPushProvider } from './push.provider';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...dataSourceOptions(), migrationsRun: true }) }),
    TypeOrmModule.forFeature([Notification, Preference, Delivery]),
  ],
  controllers: [AppController, NotificationsController],
  providers: [
    NotificationsService,
    { provide: ServiceBus, useFactory: () => new ServiceBus('notification') },
    { provide: PUSH_PROVIDER, useFactory: () => createPushProvider() },
  ],
})
export class AppModule {}
