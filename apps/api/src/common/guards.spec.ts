import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_PERMISSIONS, RoleName } from '@bus/types';
import { AppException } from '@bus/shared';
import { PermissionsGuard } from './guards';
import { PERMISSIONS_KEY, ROLES_KEY } from './decorators';

const ctx = (user: unknown, meta: Record<string, unknown>) => {
  const handler = () => undefined;
  Reflect.defineMetadata(PERMISSIONS_KEY, meta[PERMISSIONS_KEY], handler);
  Reflect.defineMetadata(ROLES_KEY, meta[ROLES_KEY], handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
};

const userWith = (role: RoleName) => ({ id: 'u', roles: [role], permissions: ROLE_PERMISSIONS[role] });

describe('PermissionsGuard (RBAC)', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('allows endpoints without requirements', () => {
    expect(guard.canActivate(ctx(userWith(RoleName.PASSENGER), {}))).toBe(true);
  });

  it('allows admin to create buses and denies passenger', () => {
    const meta = { [PERMISSIONS_KEY]: ['buses.create'] };
    expect(guard.canActivate(ctx(userWith(RoleName.ADMIN), meta))).toBe(true);
    expect(() => guard.canActivate(ctx(userWith(RoleName.PASSENGER), meta))).toThrow(AppException);
  });

  it('lets drivers verify tickets but not read audit logs', () => {
    expect(guard.canActivate(ctx(userWith(RoleName.DRIVER), { [PERMISSIONS_KEY]: ['tickets.verify'] }))).toBe(true);
    expect(() => guard.canActivate(ctx(userWith(RoleName.DRIVER), { [PERMISSIONS_KEY]: ['audit.read'] }))).toThrow(AppException);
  });

  it('enforces role restrictions and lets super admin through', () => {
    const meta = { [ROLES_KEY]: [RoleName.DRIVER] };
    expect(() => guard.canActivate(ctx(userWith(RoleName.DISPATCHER), meta))).toThrow(AppException);
    expect(guard.canActivate(ctx({ id: 's', roles: [RoleName.SUPER_ADMIN], permissions: [] }, meta))).toBe(true);
  });

  it('rejects anonymous access to protected endpoints', () => {
    expect(() => guard.canActivate(ctx(undefined, { [PERMISSIONS_KEY]: ['users.read'] }))).toThrow(AppException);
  });
});
