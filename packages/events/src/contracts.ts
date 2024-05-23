import type { Lang, LocationPoint, NotificationChannel, NotificationType } from '@bus/types';

export const EVENTS_EXCHANGE = 'bus.events';

export const Events = {
  BookingCreated: 'booking.created',
  BookingConfirmed: 'booking.confirmed',
  BookingCancelled: 'booking.cancelled',
  BookingExpired: 'booking.expired',
  TicketCreated: 'ticket.created',
  TicketVerified: 'ticket.verified',
  PaymentCreated: 'payment.created',
  PaymentSucceeded: 'payment.succeeded',
  PaymentFailed: 'payment.failed',
  PaymentRefunded: 'payment.refunded',
  TripCreated: 'trip.created',
  TripStarted: 'trip.started',
  TripDelayed: 'trip.delayed',
  TripCancelled: 'trip.cancelled',
  TripCompleted: 'trip.completed',
  TripReminder: 'trip.reminder',
  SeatLocked: 'seat.locked',
  SeatReleased: 'seat.released',
  OtpRequested: 'otp.requested',
  OtpVerified: 'otp.verified',
  TrackingLocationUpdated: 'tracking.location.updated',
  NotificationSend: 'notification.send',
  NotificationCreated: 'notification.created',
  SmsSend: 'sms.send',
  AuditLog: 'audit.log',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

export interface EventEnvelope<T = unknown> {
  id: string;
  type: string;
  source: string;
  correlationId: string;
  occurredAt: string;
  payload: T;
}

export interface Recipient {
  userId: string;
  phone?: string;
  lang?: Lang;
}

export interface BookingEventPayload {
  bookingId: string;
  code: string;
  userId: string;
  tripId: string;
  routeId: string;
  routeName: string;
  busId: string;
  driverId: string | null;
  departureAt: string;
  amount: number;
  currency: string;
  seats: string[];
  seatCount: number;
  passengerIds: string[];
  status: string;
  reason?: string;
  recipient: Recipient;
  occurredAt?: string;
  silent?: boolean;
}

export interface TicketEventPayload {
  ticketId: string;
  ticketNumber: string;
  bookingId: string;
  tripId: string;
  seat: string;
  userId: string;
  verifiedBy?: string;
  result?: string;
  recipient?: Recipient;
}

export interface PaymentEventPayload {
  paymentId: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  transactionId: string | null;
  reason?: string;
  occurredAt: string;
  routeId?: string;
  silent?: boolean;
}

export interface TripEventPayload {
  tripId: string;
  routeId: string;
  routeName: string;
  busId: string;
  driverId: string | null;
  departureAt: string;
  arrivalAt: string;
  status: string;
  capacity: number;
  busPlate?: string;
  driverName?: string;
  delayMinutes?: number;
  reason?: string;
  recipients: Recipient[];
  occurredAt?: string;
  silent?: boolean;
}

export interface SeatEventPayload {
  tripId: string;
  seatId: string;
  number: string;
  userId: string | null;
  status: string;
}

export interface OtpEventPayload {
  phone: string;
  purpose: string;
}

export interface NotificationSendPayload {
  type: NotificationType;
  recipients: Recipient[];
  params: Record<string, string | number>;
  channels?: NotificationChannel[];
  data?: Record<string, unknown>;
}

export interface NotificationCreatedPayload {
  id: string;
  userId: string;
  type: NotificationType;
  title: Record<string, string>;
  body: Record<string, string>;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface SmsSendPayload {
  phone: string;
  text: string;
}

export interface AuditLogPayload {
  userId: string | null;
  userRole: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  method: string | null;
  endpoint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type TrackingEventPayload = LocationPoint;
