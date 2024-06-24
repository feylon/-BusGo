import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ enum: ['LOGIN', 'REGISTER', 'RESET'], default: 'LOGIN' })
  @IsOptional()
  @IsIn(['LOGIN', 'REGISTER', 'RESET'])
  purpose?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 150)
  fullName?: string;
}

export class RegisterDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code: string;

  @ApiProperty()
  @IsString()
  @Length(2, 150)
  fullName: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class LoginDto {
  @ApiProperty({ example: '+998900000001', description: 'Phone or email' })
  @IsString()
  login: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 150)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ['uz', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  lang?: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
