import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TicketStatus } from '@bus/types';
import { AuthUser, CurrentUser, RequirePermissions } from '../../common/decorators';
import { PageQuery } from '../../common/dto';
import { TicketsService } from './tickets.service';

export class VerifyTicketDto {
  @ApiProperty({ description: 'Token read from the QR code' })
  @IsString()
  token: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tripId?: string;
}

export class TicketQuery extends PageQuery {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tripId?: string;
}

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('my')
  mine(@CurrentUser() user: AuthUser, @Query() q: TicketQuery) {
    return this.tickets.mine(user.id, q);
  }

  @Get()
  @RequirePermissions('tickets.read')
  list(@Query() q: TicketQuery) {
    return this.tickets.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.get(id, user);
  }

  @Post('verify')
  @RequirePermissions('tickets.verify')
  verify(@Body() dto: VerifyTicketDto, @CurrentUser() user: AuthUser, @Req() req: any) {
    return this.tickets.verify(dto.token, user, dto.tripId, req);
  }
}
