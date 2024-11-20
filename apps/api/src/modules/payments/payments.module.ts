import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { AuditAction, BookingStatus, PaymentStatus, RoleName } from '@bus/types';
import { Events, PaymentEventPayload } from '@bus/events';
import { AppException } from '@bus/shared';
import { Booking } from '../bookings/booking.entity';
import { BookingsModule } from '../bookings/bookings.module';
import { BookingsService, isStaff } from '../bookings/bookings.service';
import { ClientsService } from '../../common/clients.service';
import { EventsService } from '../../common/events.service';
import { Audit, AuthUser, CorrelationId, CurrentUser, RequirePermissions, Roles } from '../../common/decorators';
import { PageQuery } from '../../common/dto';
import { PayBookingDto } from '../bookings/bookings.dto';

export interface PaymentView {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  transactionId: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export class MockCompleteDto {
  @ApiProperty({ description: 'true = success, false = failure' })
  @IsBoolean()
  success: boolean;
}

export class RefundDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PaymentQuery extends PageQuery {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus))
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>,
    private readonly bookings: BookingsService,
    private readonly clients: ClientsService,
    private readonly events: EventsService,
  ) {}

  onModuleInit() {
    this.events.on<PaymentEventPayload>(Events.PaymentSucceeded, 'api.payment-succeeded', async (e) => {
      await this.bookings.confirmPaid(e.payload.bookingId, e.payload.paymentId, e.correlationId);
    });
    this.events.on<PaymentEventPayload>(Events.PaymentFailed, 'api.payment-failed', async (e) => {
      await this.bookings.markPayment(e.payload.bookingId, e.payload.paymentId, PaymentStatus.FAILED);
    });
    this.events.on<PaymentEventPayload>(Events.PaymentRefunded, 'api.payment-refunded', async (e) => {
      await this.bookings.markPayment(e.payload.bookingId, e.payload.paymentId, PaymentStatus.REFUNDED);
    });
  }

  async initiate(bookingId: string, user: AuthUser, provider = 'mock', correlationId?: string) {
    const booking = await this.bookingsRepo.findOne({ where: { id: bookingId } });
    if (!booking || (booking.userId !== user.id && !isStaff(user)))
      throw new AppException('BOOKING_NOT_FOUND', HttpStatus.NOT_FOUND);
    if (booking.status !== BookingStatus.PENDING) throw new AppException('BOOKING_INVALID_STATUS', HttpStatus.CONFLICT);
    if (booking.expiresAt && booking.expiresAt.getTime() < Date.now())
      throw new AppException('BOOKING_EXPIRED', HttpStatus.CONFLICT);
    const payment = await this.clients.payment.post<PaymentView>(
      '/payments',
      {
        bookingId: booking.id,
        userId: booking.userId,
        amount: booking.totalAmount,
        currency: booking.currency,
        provider,
        expiresAt: booking.expiresAt,
        description: `Booking ${booking.code}`,
      },
      { correlationId },
    );
    await this.bookingsRepo.update(booking.id, { paymentId: payment.id, paymentStatus: payment.status });
    return payment;
  }

  async get(id: string, user: AuthUser) {
    const payment = await this.clients.payment.get<PaymentView>(`/payments/${id}`);
    if (payment.userId !== user.id && !isStaff(user)) throw new AppException('PAYMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    return payment;
  }

  list(q: PaymentQuery) {
    return this.clients.payment.get('/payments', { params: q });
  }

  async mockComplete(id: string, success: boolean, user: AuthUser, correlationId?: string) {
    await this.get(id, user);
    const payment = await this.clients.payment.post<PaymentView>(`/payments/${id}/mock-complete`, { success }, { correlationId });
    if (payment.status === PaymentStatus.SUCCEEDED) {
      await this.bookings.confirmPaid(payment.bookingId, payment.id, correlationId);
    } else if (payment.status === PaymentStatus.FAILED) {
      await this.bookings.markPayment(payment.bookingId, payment.id, PaymentStatus.FAILED);
    }
    return payment;
  }

  refund(id: string, reason: string | undefined, correlationId?: string) {
    return this.clients.payment.post<PaymentView>(`/payments/${id}/refund`, { reason }, { correlationId });
  }
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('bookings/:id/pay')
  @Audit(AuditAction.PAYMENT_CREATED, 'booking')
  pay(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayBookingDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() cid: string,
  ) {
    return this.payments.initiate(id, user, dto.provider ?? 'mock', cid);
  }

  @Get('payments')
  @RequirePermissions('reports.read')
  list(@Query() q: PaymentQuery) {
    return this.payments.list(q);
  }

  @Get('payments/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.payments.get(id, user);
  }

  @Post('payments/:id/mock/complete')
  @Audit(AuditAction.PAYMENT_SUCCEEDED, 'payment')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MockCompleteDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() cid: string,
  ) {
    return this.payments.mockComplete(id, dto.success, user, cid);
  }

  @Post('payments/:id/refund')
  @Roles(RoleName.ADMIN)
  @Audit(AuditAction.PAYMENT_CREATED, 'payment')
  refund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundDto, @CorrelationId() cid: string) {
    return this.payments.refund(id, dto.reason, cid);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), BookingsModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
