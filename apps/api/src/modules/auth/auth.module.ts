import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { env } from '@bus/config';
import { User } from '../users/user.entity';
import { Role } from '../users/role.entity';
import { Driver } from '../drivers/driver.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Driver]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: env('JWT_SECRET', 'dev-jwt-secret-change-me'),
        signOptions: { expiresIn: env('JWT_EXPIRES_IN', '15m') as any },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, OtpService],
  controllers: [AuthController],
  exports: [AuthService, OtpService, JwtModule],
})
export class AuthModule {}
