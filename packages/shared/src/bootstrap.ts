import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from './nest';

export async function bootstrapService(module: unknown, name: string, defaultPort: number): Promise<INestApplication> {
  const app = await NestFactory.create(module as any, { logger: ['log', 'warn', 'error'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  const port = Number(process.env.PORT) || defaultPort;
  await app.listen(port, '0.0.0.0');
  Logger.log(`${name} listening on :${port}`, 'Bootstrap');
  return app;
}
