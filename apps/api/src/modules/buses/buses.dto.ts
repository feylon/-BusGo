import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BusSeatStatus, BusStatus, LayoutCellKind, SeatType } from '@bus/types';
import { PageQuery } from '../../common/dto';

export class LayoutCellDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  row: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  col: number;

  @ApiProperty({ enum: LayoutCellKind })
  @IsEnum(LayoutCellKind)
  kind: LayoutCellKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 10)
  number?: string;

  @ApiPropertyOptional({ enum: SeatType })
  @IsOptional()
  @IsEnum(SeatType)
  type?: SeatType;

  @ApiPropertyOptional({ enum: BusSeatStatus })
  @IsOptional()
  @IsEnum(BusSeatStatus)
  status?: BusSeatStatus;
}

export class LayoutDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  @Max(40)
  rows: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(10)
  cols: number;

  @ApiProperty({ type: [LayoutCellDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutCellDto)
  cells: LayoutCellDto[];
}

export class CreateBusDto {
  @ApiProperty({ example: 'Yutong Express 01' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ example: 'Yutong ZK6122H9' })
  @IsString()
  @Length(2, 100)
  model: string;

  @ApiProperty({ example: '01A123BC' })
  @IsString()
  @Length(4, 20)
  plateNumber: string;

  @ApiPropertyOptional({ example: '101' })
  @IsOptional()
  @IsString()
  busNumber?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ enum: BusStatus })
  @IsOptional()
  @IsEnum(BusStatus)
  status?: BusStatus;

  @ApiPropertyOptional({ type: LayoutDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LayoutDto)
  layout?: LayoutDto;
}

export class UpdateBusDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 100)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(4, 20)
  plateNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  busNumber?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ enum: BusStatus })
  @IsOptional()
  @IsEnum(BusStatus)
  status?: BusStatus;
}

export class UpdateSeatDto {
  @ApiPropertyOptional({ enum: BusSeatStatus })
  @IsOptional()
  @IsEnum(BusSeatStatus)
  status?: BusSeatStatus;

  @ApiPropertyOptional({ enum: SeatType })
  @IsOptional()
  @IsEnum(SeatType)
  type?: SeatType;
}

export class BusQuery extends PageQuery {
  @ApiPropertyOptional({ enum: BusStatus })
  @IsOptional()
  @IsEnum(BusStatus)
  status?: BusStatus;
}
