import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@bus/types';
import { Audit, AuthUser, CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { RoutesService } from './routes.service';
import { CreateRouteDto, RouteQuery, UpdateRouteDto } from './routes.dto';

@ApiTags('Routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Public()
  @Get()
  list(@Query() q: RouteQuery, @CurrentUser() user?: AuthUser) {
    return this.routes.list(q, !user?.permissions.includes('routes.manage'));
  }

  @Public()
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.routes.get(id);
  }

  @ApiBearerAuth()
  @Post()
  @RequirePermissions('routes.manage')
  @Audit(AuditAction.ROUTE_CREATED, 'route')
  create(@Body() dto: CreateRouteDto) {
    return this.routes.create(dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @RequirePermissions('routes.manage')
  @Audit(AuditAction.ROUTE_UPDATED, 'route')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRouteDto) {
    return this.routes.update(id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @RequirePermissions('routes.manage')
  @Audit(AuditAction.ROUTE_DELETED, 'route')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.routes.remove(id);
  }
}
