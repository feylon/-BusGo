import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { TripStatus } from '@bus/types';
import { PageQuery } from '../../common/dto';

export class CreateTripDto {
  @ApiProperty()
  @IsUUID()
  routeId: string;

  @ApiProperty()
  @IsUUID()
  busId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiProperty({ example: '2025-01-10T08:00:00+05:00' })
  @IsDateString()
  departureAt: string;

  @ApiPropertyOptional({ description: 'Defaults to departure + route duration' })
  @IsOptional()
  @IsDateString()
  arrivalAt?: string;

  @ApiProperty({ example: 80000, description: 'Base price for the full route' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;
}

export class GenerateTripsDto extends CreateTripDto {
  @ApiProperty({ example: 7, description: 'Number of days to repeat the trip' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days: number;
}

export class UpdateTripDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  busId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  driverId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  departureAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  arrivalAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;
}

export class AssignDriverDto {
  @ApiProperty()
  @IsUUID()
  driverId: string;
}

export class DelayTripDto {
  @ApiProperty({ example: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  reason?: string;
}

export class CancelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  reason?: string;
}

export class TripQuery extends PageQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  busId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @ApiPropertyOptional({ example: '2025-01-10' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class TripSearchQuery {
  @ApiProperty({ description: 'City name or stop id', example: 'Toshkent' })
  @IsString()
  from: string;

  @ApiProperty({ description: 'City name or stop id', example: 'Samarqand' })
  @IsString()
  to: string;

  @ApiPropertyOptional({ example: '2025-01-10' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  passengers?: number;
}

export class SegmentQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromStopId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toStopId?: string;
}
