import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceBus } from '@bus/shared';
import { dataSourceOptions } from './data-source';
import { Payment } from './payment.entity';
import { PaymentLog } from './payment-log.entity';
import { PaymentsService } from './payments.service';
import { AppController, PaymentsController } from './app.controller';
import { PAYMENT_PROVIDERS, createProviders } from './payment.provider';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...dataSourceOptions(), migrationsRun: true }) }),
    TypeOrmModule.forFeature([Payment, PaymentLog]),
  ],
  controllers: [AppController, PaymentsController],
  providers: [
    PaymentsService,
    { provide: ServiceBus, useFactory: () => new ServiceBus('payment') },
    { provide: PAYMENT_PROVIDERS, useFactory: () => createProviders() },
  ],
})
export class AppModule {}
