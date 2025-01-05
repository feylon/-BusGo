# Ma'lumotlar bazasi

Har bir servis o'z PostgreSQL bazasiga ega (bitta Postgres instansiyasida alohida database'lar).

## bus_core (Main API)

| Jadval | Muhim ustunlar / constraint'lar |
| --- | --- |
| users | phone (unique), email (unique), passwordHash (argon2), status, lang |
| roles, permissions, user_roles, role_permissions | RBAC |
| passengers | userId, fullName, phone, documentNumber |
| drivers | userId (unique), licenseNumber (unique), status |
| buses | plateNumber (unique), capacity, layout (jsonb: rows, cols, cells), amenities, status |
| bus_seats | (busId, number) unique, (busId, row, column) unique, type, position, status, metadata |
| stops | name, city, region, latitude, longitude |
| routes | code (unique), originId, destinationId, distanceKm, durationMin |
| route_stops | (routeId, order) unique, (routeId, stopId) unique, arrival/departureOffsetMin, distanceFromStartKm |
| trips | routeId, busId, driverId, departureAt, arrivalAt, status, price, delayMinutes, version |
| trip_seats | (tripId, number) unique — avtobus sxemasining qatnov uchun snapshot'i; status, lockedBy, lockedUntil, bookingId |
| pricing_rules | routeId, fromStopId, toStopId, seatType (null = barcha), price, validFrom, validTo |
| bookings | code (unique), userId, tripId, from/toStopId, status, totalAmount, expiresAt, paymentId, paymentStatus |
| booking_items | **UNIQUE (tripSeatId) WHERE active = true** |
| tickets | ticketNumber (unique), qrToken (unique), bookingItemId (unique), status, usedAt, verifiedBy |
| responsibles | entityType (TRIP/ROUTE/BUS/REGION), entityId, name, phone, role, region |
| settings | key → jsonb |
| processed_events | (eventId, handler) PK |

## Microservice bazalari

| Baza | Jadvallar |
| --- | --- |
| bus_notification | notifications ((eventId, userId) unique), notification_preferences, notification_deliveries, processed_events |
| bus_audit | audit_logs (eventId unique, indekslar: createdAt, action+createdAt, entity+entityId, userId, ipAddress) |
| bus_tracking | location_history (tripId + recordedAt indeks) |
| bus_payment | payments, payment_logs |
| bus_reporting | report_bookings, report_trips, report_payments, daily_summaries, processed_events |

Narxlar so'mda butun son (`int`) sifatida saqlanadi. Barcha vaqtlar `timestamptz`, ko'rsatish `Asia/Tashkent` vaqt zonasida.
