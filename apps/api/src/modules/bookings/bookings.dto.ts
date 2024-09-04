import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { BookingStatus } from '@bus/types';
import { PageQuery } from '../../common/dto';

export class PassengerInfoDto {
  @ApiProperty({ example: 'Aziz Karimov' })
  @IsString()
  @Length(2, 150)
  fullName: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'AB1234567' })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  documentNumber?: string;

  @ApiPropertyOptional({ example: '1995-04-12' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE'] })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE'])
  gender?: string;
}

export class BookingSeatDto {
  @ApiProperty()
  @IsUUID()
  seatId: string;

  @ApiProperty({ type: PassengerInfoDto })
  @ValidateNested()
  @Type(() => PassengerInfoDto)
  passenger: PassengerInfoDto;
}

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  tripId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromStopId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toStopId?: string;

  @ApiProperty({ type: [BookingSeatDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BookingSeatDto)
  seats: BookingSeatDto[];
}

export class BookingQuery extends PageQuery {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class PayBookingDto {
  @ApiPropertyOptional({ example: 'mock', default: 'mock' })
  @IsOptional()
  @IsString()
  provider?: string;
}
