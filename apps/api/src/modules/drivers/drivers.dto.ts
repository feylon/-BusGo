import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, MinLength } from 'class-validator';
import { PageQuery } from '../../common/dto';
import { DriverStatus } from './driver.entity';

export class CreateDriverDto {
  @ApiProperty()
  @IsString()
  @Length(2, 150)
  fullName: string;

  @ApiProperty({ example: '+998901112233' })
  @IsString()
  phone: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'AA1234567' })
  @IsString()
  @Length(3, 30)
  licenseNumber: string;

  @ApiPropertyOptional({ example: 'D' })
  @IsOptional()
  @IsString()
  licenseCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 150)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 30)
  licenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class DriverQuery extends PageQuery {
  @ApiPropertyOptional({ enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
