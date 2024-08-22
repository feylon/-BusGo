import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQuery } from '../../common/dto';

export class RouteStopDto {
  @ApiProperty()
  @IsUUID()
  stopId: string;

  @ApiProperty({ description: 'Minutes from trip departure', example: 0 })
  @IsInt()
  @Min(0)
  arrivalOffsetMin: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  departureOffsetMin: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceFromStartKm?: number;
}

export class CreateRouteDto {
  @ApiProperty({ example: 'Toshkent — Samarqand' })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ example: 'TAS-SKD' })
  @IsString()
  @Length(2, 20)
  code: string;

  @ApiProperty({ type: [RouteStopDto], description: 'Ordered list. First = origin, last = destination' })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => RouteStopDto)
  stops: RouteStopDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRouteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 20)
  code?: string;

  @ApiPropertyOptional({ type: [RouteStopDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => RouteStopDto)
  stops?: RouteStopDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class RouteQuery extends PageQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;
}
