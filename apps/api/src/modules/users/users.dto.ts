import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { RoleName, UserStatus } from '@bus/types';
import { PageQuery } from '../../common/dto';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @Length(2, 150)
  fullName: string;

  @ApiProperty({ example: '+998901112233' })
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: RoleName, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RoleName, { each: true })
  roles: RoleName[];
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 150)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ enum: RoleName, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(RoleName, { each: true })
  roles?: RoleName[];

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UserQuery extends PageQuery {
  @ApiPropertyOptional({ enum: RoleName })
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
