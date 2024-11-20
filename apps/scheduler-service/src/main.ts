import 'reflect-metadata';
import { bootstrapService } from '@bus/shared';
import { ServicePorts } from '@bus/config';
import { AppModule } from './app.module';

bootstrapService(AppModule, 'scheduler-service', ServicePorts.scheduler);
