import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceBus } from '@bus/shared';
import { dataSourceOptions } from './data-source';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AppController } from './app.controller';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...dataSourceOptions(), migrationsRun: true }) }),
    TypeOrmModule.forFeature([AuditLog]),
  ],
  controllers: [AppController],
  providers: [AuditService, { provide: ServiceBus, useFactory: () => new ServiceBus('audit') }],
})
export class AppModule {}
