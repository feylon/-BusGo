# Eventlar

Exchange: `bus.events` (topic). Envelope:

```json
{
  "id": "uuid",
  "type": "booking.confirmed",
  "source": "api",
  "correlationId": "uuid",
  "occurredAt": "2025-01-05T10:00:00.000Z",
  "payload": {}
}
```

| Event | Publisher | Consumer'lar | Payload (asosiy maydonlar) |
| --- | --- | --- | --- |
| `booking.created` | api | notification | bookingId, code, userId, tripId, routeName, seats, amount, recipient |
| `booking.confirmed` | api | notification, reporting | + departureAt, seatCount, routeId, busId, driverId |
| `booking.cancelled` | api | notification, reporting | + reason |
| `booking.expired` | api | notification | + reason=PAYMENT_TIMEOUT |
| `ticket.created` | api | notification | ticketId, ticketNumber, bookingId, seat, recipient |
| `ticket.verified` | api | — (audit izi uchun) | ticketId, result, verifiedBy |
| `payment.created` | payment | — | paymentId, bookingId, amount, status |
| `payment.succeeded` | payment | api, notification, reporting | + transactionId |
| `payment.failed` | payment | api, notification, reporting | + reason (CARD_DECLINED, TIMEOUT) |
| `payment.refunded` | payment | api, notification, reporting | |
| `trip.created/started/delayed/cancelled/completed` | api | reporting, notification (started/delayed/cancelled), tracking (completed/cancelled) | tripId, routeName, busPlate, driverName, capacity, delayMinutes, recipients |
| `trip.reminder` | api (scheduler orqali) | notification | recipients |
| `seat.locked`, `seat.released` | api | — (kengaytirish uchun) | tripId, seatId, number, userId |
| `otp.requested`, `otp.verified` | sms | — | phone, purpose |
| `tracking.location.updated` | tracking | — (30s da bir marta, analitika uchun) | LocationPoint |
| `notification.send` | api | notification | type, recipients, params, channels |
| `notification.created` | notification | api (WebSocket push) | id, userId, title{uz,ru,en}, body{uz,ru,en} |
| `sms.send` | notification | sms | phone, text |
| `audit.log` | api | audit | userId, userRole, action, entity, entityId, method, endpoint, ip, userAgent, metadata |

## Navbatlar

```text
<service>.events   asosiy navbat (bus.events'ga pattern'lar bilan bog'langan)
<service>.retry    x-message-ttl=5000, dead-letter → "" / <service>.events
<service>.dlq      5 marta muvaffaqiyatsiz bo'lgan xabarlar
```

Consumer xatoligida xabar `x-retry-count` header'i oshirilib retry navbatiga yuboriladi, chegaradan keyin DLQ ga.

## Idempotentlik

* api, notification, reporting — `processed_events(eventId, handler)` jadvali, handler bilan bitta tranzaksiyada.
* audit — `audit_logs.eventId` unique.
* sms — Redis `sms:event:{id}` (NX, 24h).
* Biznes darajasida ham: `confirmPaid` holatni tekshiradi, payment `transition()` `FOR UPDATE` bilan.
