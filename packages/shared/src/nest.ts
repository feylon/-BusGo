import {
  ArgumentsHost,
  CanActivate,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { CORRELATION_HEADER, INTERNAL_TOKEN_HEADER } from './utils';
import { pickLang, translate } from './messages';

export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ code, details }, status);
  }
}

export const notFound = (code = 'NOT_FOUND') => new AppException(code, HttpStatus.NOT_FOUND);
export const conflict = (code: string, details?: unknown) => new AppException(code, HttpStatus.CONFLICT, details);
export const badRequest = (code: string, details?: unknown) => new AppException(code, HttpStatus.BAD_REQUEST, details);
export const forbidden = (code = 'FORBIDDEN') => new AppException(code, HttpStatus.FORBIDDEN);

const statusCodes: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const lang = pickLang(req.headers['accept-language'] ?? req.headers['x-lang']);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let details: unknown;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as any;
      code = (typeof body === 'object' && body?.code) || statusCodes[status] || 'INTERNAL_ERROR';
      if (status === 400 && Array.isArray(body?.message)) details = body.message;
      else if (typeof body === 'object' && body?.details) details = body.details;
    } else {
      this.logger.error(
        `${req.method} ${req.url} [${req.headers[CORRELATION_HEADER] ?? '-'}]: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    res.status(status).json({
      statusCode: status,
      code,
      message: translate(code, lang),
      details,
      correlationId: req.headers[CORRELATION_HEADER],
      timestamp: new Date().toISOString(),
    });
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const id = (req.headers[CORRELATION_HEADER] as string) || randomUUID();
    req.headers[CORRELATION_HEADER] = id;
    req.correlationId = id;
    res.setHeader(CORRELATION_HEADER, id);
    next();
  }
}

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const expected = process.env.INTERNAL_TOKEN ?? '';
    const given = String(req.headers[INTERNAL_TOKEN_HEADER] ?? '');
    if (!expected || given.length !== expected.length) throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected)))
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    return true;
  }
}

export type HealthCheck = () => Promise<boolean> | boolean;

export async function runHealthChecks(checks: Record<string, HealthCheck>) {
  const results: Record<string, 'up' | 'down'> = {};
  await Promise.all(
    Object.entries(checks).map(async ([name, fn]) => {
      try {
        results[name] = (await Promise.race([
          Promise.resolve(fn()),
          new Promise<boolean>((r) => setTimeout(() => r(false), 3000)),
        ]))
          ? 'up'
          : 'down';
      } catch {
        results[name] = 'down';
      }
    }),
  );
  const ok = Object.values(results).every((v) => v === 'up');
  return { ok, body: { status: ok ? 'ok' : 'error', checks: results, uptime: Math.round(process.uptime()) } };
}
