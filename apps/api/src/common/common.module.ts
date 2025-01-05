import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from './redis.service';
import { EventsService } from './events.service';
import { ClientsService } from './clients.service';
import { AuditService } from './audit.service';
import { ProcessedEvent } from './processed-event.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ProcessedEvent])],
  providers: [RedisService, EventsService, ClientsService, AuditService],
  exports: [RedisService, EventsService, ClientsService, AuditService],
})
export class CommonModule {}
