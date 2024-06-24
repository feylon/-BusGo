import { Injectable } from '@nestjs/common';
import { InternalClient } from '@bus/shared';
import { env, envInt } from '@bus/config';

const make = (name: string, urlVar: string, fallback: string, timeoutMs?: number) =>
  new InternalClient({
    name,
    baseURL: env(urlVar, fallback),
    token: env('INTERNAL_TOKEN', 'dev-internal-token'),
    timeoutMs: timeoutMs ?? envInt('INTERNAL_HTTP_TIMEOUT_MS', 5000),
  });

@Injectable()
export class ClientsService {
  readonly notification = make('notification-service', 'NOTIFICATION_SERVICE_URL', 'http://localhost:3101');
  readonly sms = make('sms-service', 'SMS_SERVICE_URL', 'http://localhost:3102');
  readonly audit = make('audit-service', 'AUDIT_SERVICE_URL', 'http://localhost:3103');
  readonly tracking = make('tracking-service', 'TRACKING_SERVICE_URL', 'http://localhost:3104', 3000);
  readonly payment = make('payment-service', 'PAYMENT_SERVICE_URL', 'http://localhost:3105');
  readonly scheduler = make('scheduler-service', 'SCHEDULER_SERVICE_URL', 'http://localhost:3106');
  readonly reporting = make('reporting-service', 'REPORTING_SERVICE_URL', 'http://localhost:3107', 15000);
}
