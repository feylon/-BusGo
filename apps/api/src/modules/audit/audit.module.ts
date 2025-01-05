import { Controller, Get, Module, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { ClientsService } from '../../common/clients.service';
import { RequirePermissions } from '../../common/decorators';
import { PageQuery } from '../../common/dto';

export class AuditQuery extends PageQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@RequirePermissions('audit.read')
export class AuditController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@Query() q: AuditQuery) {
    return this.clients.audit.get('/audit', { params: q });
  }

  @Get('actions')
  actions() {
    return this.clients.audit.get('/audit/actions');
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.audit.get(`/audit/${id}`);
  }
}

@Module({ controllers: [AuditController] })
export class AuditProxyModule {}
