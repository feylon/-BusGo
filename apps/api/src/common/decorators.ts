import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '@bus/types';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const AUDIT_KEY = 'audit';
export interface AuditMeta {
  action: string;
  entity: string;
}
export const Audit = (action: string, entity: string) => SetMetadata(AUDIT_KEY, { action, entity } as AuditMeta);

export interface AuthUser {
  id: string;
  phone: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  driverId?: string | null;
  lang: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export const CorrelationId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest().correlationId;
});
