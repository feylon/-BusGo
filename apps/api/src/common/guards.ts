import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RoleName } from '@bus/types';
import { AppException } from '@bus/shared';
import { AuthUser, IS_PUBLIC, PERMISSIONS_KEY, ROLES_KEY } from './decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) {
      const req = ctx.switchToHttp().getRequest();
      if (!req.headers.authorization) return true;
      return Promise.resolve(super.canActivate(ctx) as Promise<boolean>).catch(() => true);
    }
    return super.canActivate(ctx);
  }

  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    return user;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const perms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]);
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!perms?.length && !roles?.length) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    if (user.roles.includes(RoleName.SUPER_ADMIN)) return true;
    if (roles?.length && !roles.some((r) => user.roles.includes(r))) throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    if (perms?.length && !perms.every((p) => user.permissions.includes(p)))
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    return true;
  }
}
