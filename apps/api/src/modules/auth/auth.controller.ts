import { Body, Controller, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditAction } from '@bus/types';
import { AuthUser, CorrelationId, CurrentUser, Public } from '../../common/decorators';
import { AuditService } from '../../common/audit.service';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  SendOtpDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('otp/send')
  @HttpCode(200)
  sendOtp(@Body() dto: SendOtpDto, @CorrelationId() cid: string) {
    return this.otp.send(this.auth.phoneOrFail(dto.phone), dto.purpose ?? 'LOGIN', cid);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @CorrelationId() cid: string, @Req() req: any) {
    const result = await this.auth.loginWithOtp(dto, cid);
    this.audit.fromRequest(req, {
      action: result.created ? AuditAction.USER_REGISTERED : AuditAction.USER_LOGIN,
      entity: 'user',
      entityId: result.user.id,
      userId: result.user.id,
      userRole: result.user.roles[0],
      metadata: { method: 'otp' },
    });
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @CorrelationId() cid: string, @Req() req: any) {
    const result = await this.auth.register(dto, cid);
    this.audit.fromRequest(req, {
      action: AuditAction.USER_REGISTERED,
      entity: 'user',
      entityId: result.user.id,
      userId: result.user.id,
      userRole: result.user.roles[0],
    });
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const result = await this.auth.login(dto);
    this.audit.fromRequest(req, {
      action: AuditAction.USER_LOGIN,
      entity: 'user',
      entityId: result.user.id,
      userId: result.user.id,
      userRole: result.user.roles[0],
      metadata: { method: 'password' },
    });
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(200)
  async logout(@Body() dto: Partial<RefreshDto>, @Req() req: any) {
    this.audit.fromRequest(req, { action: AuditAction.USER_LOGOUT, entity: 'user', entityId: req.user.id });
    return this.auth.logout(dto?.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.profile(user.id);
  }

  @ApiBearerAuth()
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @ApiBearerAuth()
  @Patch('me/password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }
}
