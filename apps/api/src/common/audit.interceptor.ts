import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs';
import { AUDIT_KEY, AuditMeta } from './decorators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const meta = this.reflector.get<AuditMeta>(AUDIT_KEY, ctx.getHandler());
    if (!meta || ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      tap((result) => {
        const entityId = req.params?.id ?? (result && typeof result === 'object' ? (result as any).id : null) ?? null;
        this.audit.fromRequest(req, {
          action: meta.action,
          entity: meta.entity,
          entityId,
          metadata: { params: req.params, body: req.body },
        });
      }),
    );
  }
}
