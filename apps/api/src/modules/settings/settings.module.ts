import { Body, Controller, Get, Module, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditAction } from '@bus/types';
import { Setting } from './setting.entity';
import { SettingsService } from './settings.service';
import { Audit, Public, RequirePermissions } from '../../common/decorators';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('public')
  async publicSettings() {
    const all = await this.settings.all();
    return {
      companyName: all['company.name'],
      companyPhone: all['company.phone'],
      currency: all['company.currency'],
      seatLockTtlSec: all['booking.seatLockTtlSec'],
      paymentTimeoutMin: all['booking.paymentTimeoutMin'],
      maxSeatsPerBooking: all['booking.maxSeatsPerBooking'],
    };
  }

  @ApiBearerAuth()
  @Get()
  @RequirePermissions('settings.manage')
  all() {
    return this.settings.all();
  }

  @ApiBearerAuth()
  @Put()
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  @RequirePermissions('settings.manage')
  @Audit(AuditAction.SETTINGS_UPDATED, 'settings')
  update(@Body() body: Record<string, unknown>) {
    return this.settings.update(body);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
