import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  providers: [SchedulerService],
})
export class AppModule {}
