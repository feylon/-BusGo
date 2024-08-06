import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { SeatType } from '@bus/types';
import { PageQuery } from '../../common/dto';

export class CreatePricingDto {
  @ApiProperty()
  @IsUUID()
  routeId: string;

  @ApiProperty()
  @IsUUID()
  fromStopId: string;

  @ApiProperty()
  @IsUUID()
  toStopId: string;

  @ApiPropertyOptional({ enum: SeatType, nullable: true })
  @IsOptional()
  @IsEnum(SeatType)
  seatType?: SeatType | null;

  @ApiProperty({ example: 80000 })
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'UZS' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePricingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromStopId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toStopId?: string;

  @ApiPropertyOptional({ enum: SeatType, nullable: true })
  @IsOptional()
  @IsEnum(SeatType)
  seatType?: SeatType | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class PricingQuery extends PageQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  routeId?: string;
}
