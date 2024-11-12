import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BookingEventPayload, EventEnvelope, Events, PaymentEventPayload, TripEventPayload } from '@bus/events';
import { ServiceBus } from '@bus/shared';
import { ReportBooking, ReportPayment, ReportTrip } from './read-model.entity';
import { idempotent } from './idempotent';

@Injectable()
export class ProjectorService implements OnModuleInit {
  constructor(
    private readonly bus: ServiceBus,
    private readonly ds: DataSource,
  ) {}

  onModuleInit() {
    const on = <T>(event: string, fn: (e: EventEnvelope<T>, m: EntityManager) => Promise<void>) =>
      this.bus.on<T>(event, idempotent<T>(this.ds, `report:${event}`, fn));

    on<BookingEventPayload>(Events.BookingConfirmed, async (e, m) => {
      const p = e.payload;
      const at = new Date(p.occurredAt ?? e.occurredAt);
      await m
        .createQueryBuilder()
        .insert()
        .into(ReportBooking)
        .values({
          bookingId: p.bookingId,
          code: p.code,
          userId: p.userId,
          tripId: p.tripId,
          routeId: p.routeId,
          routeName: p.routeName,
          busId: p.busId ?? null,
          driverId: p.driverId ?? null,
          amount: p.amount,
          seats: p.seatCount,
          status: 'CONFIRMED',
          departureAt: p.departureAt ? new Date(p.departureAt) : null,
          confirmedAt: at,
        })
        .orUpdate(['status', 'amount', 'seats', 'confirmedAt'], ['bookingId'])
        .execute();
      await this.recalcTrip(m, p.tripId);
    });

    on<BookingEventPayload>(Events.BookingCancelled, async (e, m) => {
      const p = e.payload;
      await m.update(
        ReportBooking,
        { bookingId: p.bookingId },
        { status: 'CANCELLED', cancelReason: p.reason ?? null, cancelledAt: new Date(p.occurredAt ?? e.occurredAt) },
      );
      await this.recalcTrip(m, p.tripId);
    });

    const trip = async (e: EventEnvelope<TripEventPayload>, m: EntityManager) => {
      const p = e.payload;
      await m
        .createQueryBuilder()
        .insert()
        .into(ReportTrip)
        .values({
          tripId: p.tripId,
          routeId: p.routeId,
          routeName: p.routeName,
          busId: p.busId,
          busPlate: p.busPlate ?? null,
          driverId: p.driverId,
          driverName: p.driverName ?? null,
          capacity: p.capacity,
          status: p.status,
          delayMinutes: p.delayMinutes ?? 0,
          departureAt: new Date(p.departureAt),
          arrivalAt: p.arrivalAt ? new Date(p.arrivalAt) : null,
          completedAt: p.status === 'COMPLETED' ? new Date(p.occurredAt ?? e.occurredAt) : null,
        })
        .orUpdate(
          ['status', 'busId', 'busPlate', 'driverId', 'driverName', 'capacity', 'delayMinutes', 'departureAt', 'arrivalAt', 'completedAt'],
          ['tripId'],
        )
        .execute();
      await this.recalcTrip(m, p.tripId);
    };
    for (const ev of [Events.TripCreated, Events.TripStarted, Events.TripDelayed, Events.TripCancelled, Events.TripCompleted]) on(ev, trip);

    const payment = async (e: EventEnvelope<PaymentEventPayload>, m: EntityManager) => {
      const p = e.payload;
      await m
        .createQueryBuilder()
        .insert()
        .into(ReportPayment)
        .values({
          paymentId: p.paymentId,
          bookingId: p.bookingId,
          userId: p.userId,
          amount: p.amount,
          status: p.status,
          provider: p.provider,
          reason: p.reason ?? null,
          occurredAt: new Date(p.occurredAt ?? e.occurredAt),
        })
        .orUpdate(['status', 'reason', 'occurredAt'], ['paymentId'])
        .execute();
    };
    for (const ev of [Events.PaymentSucceeded, Events.PaymentFailed, Events.PaymentRefunded]) on(ev, payment);
  }

  private async recalcTrip(m: EntityManager, tripId: string) {
    await m.query(
      `UPDATE report_trips t SET "soldSeats" = s.seats, revenue = s.revenue
       FROM (SELECT COALESCE(SUM(seats),0)::int AS seats, COALESCE(SUM(amount),0)::int AS revenue
             FROM report_bookings WHERE "tripId" = $1 AND status = 'CONFIRMED') s
       WHERE t."tripId" = $1`,
      [tripId],
    );
  }
}
