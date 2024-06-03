import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from '@bus/shared';
import { env, envInt } from '@bus/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const origins = env('FRONTEND_URL', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.setGlobalPrefix('api');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: origins, credentials: true });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true, transformOptions: { enableImplicitConversion: false } }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('BusLine API')
    .setDescription(
      'Inter-regional bus transport management & ticketing platform. Web endpoints use /api/*, mobile endpoints are grouped under "Mobile API" with the /api/mobile prefix.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Users')
    .addTag('Buses')
    .addTag('Seats')
    .addTag('Routes')
    .addTag('Stops')
    .addTag('Trips')
    .addTag('Pricing')
    .addTag('Bookings')
    .addTag('Tickets')
    .addTag('Drivers')
    .addTag('Passengers')
    .addTag('Payments')
    .addTag('Notifications')
    .addTag('Tracking')
    .addTag('Reports')
    .addTag('Audit')
    .addTag('Responsibles')
    .addTag('Settings')
    .addTag('Health')
    .addTag('Mobile API')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, doc, { swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' } });

  const port = envInt('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on :${port}, docs at /api/docs`, 'Bootstrap');
}

bootstrap();
