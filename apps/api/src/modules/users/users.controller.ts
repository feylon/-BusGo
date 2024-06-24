import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, RoleName } from '@bus/types';
import { Audit, AuthUser, CurrentUser, RequirePermissions, Roles } from '../../common/decorators';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateRolePermissionsDto, UpdateUserDto, UserQuery } from './users.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users')
  @RequirePermissions('users.read')
  list(@Query() q: UserQuery) {
    return this.users.list(q);
  }

  @Get('users/:id')
  @RequirePermissions('users.read')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.view(await this.users.get(id));
  }

  @Post('users')
  @RequirePermissions('users.create')
  @Audit(AuditAction.USER_CREATED, 'user')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor.roles);
  }

  @Patch('users/:id')
  @RequirePermissions('users.update')
  @Audit(AuditAction.USER_UPDATED, 'user')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.update(id, dto, actor.roles);
  }

  @Delete('users/:id')
  @RequirePermissions('users.delete')
  @Audit(AuditAction.USER_DELETED, 'user')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.users.remove(id, actor.id);
  }

  @Get('roles')
  @RequirePermissions('users.read')
  roles() {
    return this.users.listRoles();
  }

  @Get('permissions')
  @RequirePermissions('users.read')
  permissions() {
    return this.users.listPermissions();
  }

  @Put('roles/:id/permissions')
  @Roles(RoleName.SUPER_ADMIN)
  @Audit(AuditAction.SETTINGS_UPDATED, 'role')
  updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.users.updateRolePermissions(id, dto);
  }
}
