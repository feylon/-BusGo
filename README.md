# BusLine — viloyatlararo avtobus transporti va chipta tizimi

BusLine — viloyatlararo avtobus qatnovlarini boshqarish, dinamik o'rindiq sxemalari, onlayn chipta sotish,
QR orqali chiptani tekshirish va avtobuslarni real vaqtda kuzatish platformasi.

Tizim admin, dispetcher, haydovchi va yo'lovchi uchun alohida interfeyslarga, mobil ilovalar uchun esa
alohida **Mobile API** ga ega.

---

## Mundarija

1. [Project overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Requirements](#requirements)
5. [Installation](#installation)
6. [Environment variables](#environment-variables)
7. [Docker setup](#docker-setup)
8. [Database migration](#database-migration)
9. [Seed](#seed)
10. [Development](#development)
11. [Production](#production)
12. [Swagger](#swagger)
13. [Microservices](#microservices)
14. [RabbitMQ](#rabbitmq)
15. [Redis](#redis)
16. [Testing](#testing)
17. [Demo accounts](#demo-accounts)
18. [API structure](#api-structure)
19. [Mobile API](#mobile-api)
20. [Tracking](#tracking)
21. [Deployment](#deployment)

---

## Project overview

| Imkoniyat | Qisqacha |
| --- | --- |
| Avtobuslar | CRUD, holat (faol / nofaol / ta'mirda), qulayliklar, davlat raqami |
| Dinamik o'rindiq sxemasi | Vizual muharrir: qator/ustun qo'shish, o'rindiq, o'tish yo'lagi, haydovchi, eshik, raqamlash, tur (Standart/Komfort/VIP/Imkoniyati cheklanganlar), bloklash, ko'chirish |
| Yo'nalishlar va bekatlar | Bekatlar xaritada, yo'nalish bekatlari tartibi, vaqt offsetlari, masofa |
| Qatnovlar | Yaratish, bir necha kunga takrorlash, haydovchi/avtobus biriktirish, to'qnashuv tekshiruvi, boarding/start/delay/complete/cancel |
| Narxlar | Bekatlar oralig'i (segment), o'rindiq turi, amal qilish muddati bo'yicha; koeffitsientlar va fallback |
| Bron | Redis lock (TTL) → DB tranzaksiya + partial unique index → to'lov → tasdiq → chipta |
| Chipta | HMAC imzolangan QR token, `VALID / ALREADY_USED / EXPIRED / CANCELLED / INVALID` |
| To'lov | Alohida servis, Mock provider, idempotent yaratish, refund, timeout |
| SMS / OTP | Alohida servis, Redis'da hash, TTL, cooldown, urinishlar limiti, Mock SMS |
| Bildirishnomalar | IN_APP / PUSH / SMS kanallari, UZ/RU/EN shablonlar, WebSocket orqali real-time |
| Audit | Har bir muhim amal (kim, qachon, IP, endpoint, metadata), filtr va qidiruv |
| Tracking | Haydovchi joylashuvi → tracking-service → Redis → WebSocket → xarita, ETA |
| Scheduler | BullMQ: lock/bron/to'lov muddati, eslatmalar, kechikish, statuslar, tozalash, kunlik hisobot |
| Hisobotlar | Event-driven read model: sotuv, yo'nalishlar, avtobus/o'rindiq bandligi, haydovchilar, to'lovlar, yo'lovchilar, bekor qilishlar |
| i18n | UZ (default) / RU / EN — frontend va backend xatoliklari |

---

## Architecture

```text
                        ┌──────────────────────────────┐
                        │   Frontend (Vue 3 + Vite)    │
                        │   nginx :8080  /api /socket  │
                        └──────────────┬───────────────┘
                                       │ HTTP + WebSocket (faqat Main API bilan)
                                       ▼
                        ┌──────────────────────────────┐
                        │     Main API (NestJS) :3000  │
                        │  API Gateway / BFF + Core    │
                        │  auth, rbac, buses, seats,   │
                        │  routes, trips, pricing,     │
                        │  bookings, tickets, mobile   │
                        └───┬───────────┬──────────┬───┘
            internal HTTP   │           │          │  events
       (x-internal-token)   │           │          │
              ┌─────────────┘     ┌─────▼────┐  ┌──▼────────┐
              │                   │  Redis   │  │ RabbitMQ  │  topic exchange "bus.events"
              │                   │ lock/OTP │  │ + retry   │  per-service queue + DLQ
              │                   │ cache/WS │  │ + DLQ     │
              │                   └──────────┘  └──┬────────┘
  ┌───────────▼──────────┐                         │
  │ PostgreSQL (bus_core)│        ┌────────────────┼──────────────────────────────┐
  └──────────────────────┘        ▼                ▼               ▼              ▼
                           notification-svc   audit-svc     payment-svc    reporting-svc
                           (bus_notification) (bus_audit)   (bus_payment)  (bus_reporting)
                                  │                                             ▲
                           sms-svc (Redis)     tracking-svc (Redis + bus_tracking)
                                                                                │
                           scheduler-svc (BullMQ) ── internal HTTP ──► api / payment / reporting / cleanup
```

Asosiy qoidalar:

* Frontend **faqat** Main API bilan gaplashadi (`/api`, `/socket.io`). Microservice portlari tashqariga ochilmaydi.
* Har bir microservice o'z ma'lumotlar bazasiga ega (database-per-service). Hech bir servis boshqasining jadvaliga ulanmaydi.
* Sinxron so'rovlar — ichki HTTP (`x-internal-token`, timeout, GET uchun retry). Asinxron — RabbitMQ eventlari.
* Event consumer'lar idempotent (`processed_events` jadvali yoki unique `eventId`), har bir event `correlationId` bilan.
* Batafsil: [docs/architecture.md](docs/architecture.md), eventlar: [docs/events.md](docs/events.md), baza: [docs/database.md](docs/database.md).

---

## Tech stack

**Frontend:** Vue 3.5, TypeScript, Vite 7, Pinia 3, Vue Router 4, Axios, Vue I18n 11, Tailwind CSS 4, PrimeVue 4 (Aura),
Leaflet + OpenStreetMap, Socket.IO Client, Chart.js, `qrcode`, `html5-qrcode`.

**Backend:** NestJS 11, TypeScript 5.9, TypeORM 0.3, PostgreSQL 16, Redis 7 (ioredis), RabbitMQ 3.13 (amqplib),
BullMQ 5, JWT + Passport, argon2, Swagger, Socket.IO, class-validator, class-transformer, Helmet, Throttler (Redis storage).

**Infra:** Docker, Docker Compose, nginx, npm workspaces monorepo.

---

## Requirements

* Docker 24+ va Docker Compose v2 (faqat Docker orqali ishga tushirish uchun yetarli)
* Lokal development uchun: Node.js 22+, npm 10+

---

## Installation

```bash
git clone <repo> busline && cd busline
cp .env.example .env          # ixtiyoriy: compose default qiymatlar bilan ham ishlaydi
docker compose up --build
```

Ishga tushgach:

| Manzil | Tavsif |
| --- | --- |
| http://localhost:8080 | Frontend (yo'lovchi, admin, dispetcher, haydovchi) |
| http://localhost:3000/api/docs | Swagger |
| http://localhost:3000/api/health | API health |
| http://localhost:15672 | RabbitMQ UI (`bus` / `bus_secret`) |

---

## Environment variables

To'liq ro'yxat: [`.env.example`](.env.example). Muhimlari:

| O'zgaruvchi | Default | Tavsif |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://bus:bus_secret@postgres:5432/bus_core` | Main API bazasi |
| `*_DATABASE_URL` | `.../bus_notification` va h.k. | Har bir servisning o'z bazasi |
| `REDIS_URL` | `redis://redis:6379` | Lock, OTP, cache, tracking, BullMQ, rate limit |
| `RABBITMQ_URL` | `amqp://bus:bus_secret@rabbitmq:5672` | Event bus |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | — / `15m` | Access token |
| `JWT_REFRESH_TTL_DAYS` | `30` | Refresh token (Redis'da, rotation bilan) |
| `QR_SECRET` | — | QR token HMAC kaliti |
| `INTERNAL_TOKEN` | — | Servislararo HTTP autentifikatsiya |
| `SMS_PROVIDER` / `PAYMENT_PROVIDER` / `PUSH_PROVIDER` | `mock` | Provider tanlovi (interfeys orqali kengaytiriladi) |
| `OTP_TTL_SEC`, `OTP_RESEND_COOLDOWN_SEC`, `OTP_MAX_ATTEMPTS` | `120`, `60`, `5` | OTP qoidalari |
| `OTP_EXPOSE_CODE` | `true` | Demo uchun kodni javobda ko'rsatish (real productionda `false`) |
| `SEED_ON_START` | `true` | API start bo'lganda demo ma'lumotlarni yaratish/to'ldirish |
| `FRONTEND_URL` | `http://localhost:8080` | CORS va mock checkout URL |

Secret'lar source code ichida yo'q — barchasi environment orqali beriladi.

---

## Docker setup

```bash
docker compose up --build -d      # hammasini build qilib ishga tushirish
docker compose ps                 # holat va healthcheck'lar
docker compose logs -f api        # API loglari
docker compose logs -f sms-service | grep -A3 "MOCK SMS"   # OTP kodlari
docker compose down               # to'xtatish
docker compose down -v            # ma'lumotlar bilan birga tozalash
```

Har bir servis: alohida `Dockerfile` (multi-stage, `node:22-alpine`, non-root `node` user), environment variables,
`HEALTHCHECK`, `restart: unless-stopped`. Ishga tushish tartibi `depends_on: condition: service_healthy` orqali boshqariladi:
`postgres/redis/rabbitmq → microservices → api (migration + seed) → scheduler, frontend`.

Host portlari (`.env` orqali o'zgartiriladi): `8080` web, `3000` api, `127.0.0.1:5433` postgres,
`127.0.0.1:6380` redis, `127.0.0.1:15672` rabbitmq ui.

---

## Database migration

* Main API: TypeORM migratsiyalari `apps/api/src/database/migrations`. Konteyner start bo'lganda `node dist/database/migrate.js` avtomatik ishlaydi.
* Microservice'lar: har birida `src/migrations`, servis start bo'lganda `migrationsRun: true` bilan qo'llanadi.

Lokal:

```bash
npm run build -w @bus/api
DATABASE_URL=postgres://... npm run migration:run
# yangi migratsiya
cd apps/api && DATABASE_URL=postgres://... npm run migration:generate -- src/database/migrations/Name
```

Muhim constraint: `booking_items(tripSeatId) WHERE active = true` — partial unique index, bitta o'rindiq faqat bitta faol bronga tegishli bo'la oladi.

---

## Seed

`apps/api/src/database/seed.ts` (idempotent):

* rollar, permission'lar, admin/dispetcher, 5 haydovchi, 4 yo'lovchi
* 13 ta bekat (haqiqiy koordinatalar), 6 ta yo'nalish (oraliq bekatlar bilan), segment narxlari + VIP narxlar
* 7 ta avtobus (har xil sxemalar: 2+2, 2+1 VIP, VIP qatorlar, bloklangan o'rindiq, ta'mirdagi avtobus)
* o'tgan 30 kunlik yakunlangan qatnovlar va bronlar (hisobotlar uchun eventlar RabbitMQ'ga yuboriladi)
* hozir yo'lda bo'lgan qatnov (tracking demo), "chiqish" holatidagi qatnov (QR demo), keyingi 7 kunlik qatnovlar va bronlar
* mas'ul shaxslar, sozlamalar

Har safar API start bo'lganda keyingi `SEED_DAYS` kun uchun yetishmayotgan qatnovlar qo'shiladi.

```bash
docker compose exec api node dist/database/seed.js
```

---

## Development

```bash
npm install
npm run build:packages

# infra
docker compose up -d postgres redis rabbitmq

# servislar (alohida terminallarda)
DATABASE_URL=postgres://bus:bus_secret@localhost:5433/bus_core REDIS_URL=redis://localhost:6380 \
RABBITMQ_URL=amqp://bus:bus_secret@localhost:5672 npm run start:dev -w @bus/api
npm run start:dev -w @bus/payment-service   # va boshqalar, mos DATABASE_URL bilan

# frontend (proxy → VITE_API_PROXY, default http://localhost:3000)
npm run dev:web
```

Monorepo tuzilmasi:

```text
apps/
  frontend/              Vue 3 SPA (+ nginx.conf, Dockerfile)
  api/                   Main API (core business, gateway/BFF, websocket, mobile API)
  notification-service/  bildirishnomalar
  sms-service/           OTP + mock SMS
  audit-service/         action history
  tracking-service/      GPS joylashuv, ETA
  payment-service/       to'lovlar (mock provider)
  scheduler-service/     BullMQ background jobs
  reporting-service/     event-driven read model va hisobotlar
packages/
  types/    umumiy enum/interfeyslar, RBAC matritsasi, layout generator
  config/   env helperlar, portlar
  events/   event kontraktlari, RabbitMQ EventBus (retry + DLQ)
  shared/   xatoliklar (i18n), guard/filter/middleware, internal HTTP client, utilitlar
docker/     postgres init
docs/       arxitektura hujjatlari
```

---

## Production

* `.env` dagi barcha `change-me-*` secret'larni almashtiring, `OTP_EXPOSE_CODE=false`.
* `NODE_ENV=production`, PostgreSQL/Redis/RabbitMQ uchun boshqariladigan servislar yoki volume backup.
* Real providerlar `SmsProvider`, `PaymentProvider`, `PushProvider` interfeyslarini implement qilib, `*_PROVIDER` env orqali ulanadi.
* nginx oldiga TLS (masalan, Traefik / Caddy) qo'yiladi.
* `SEED_ON_START=false` (yoki faqat birinchi deploy uchun).

---

## Swagger

`http://localhost:3000/api/docs` — taglar: Auth, Users, Buses, Seats, Routes, Stops, Trips, Pricing, Bookings, Tickets,
Drivers, Passengers, Payments, Notifications, Tracking, Reports, Audit, Responsibles, Settings, Health, **Mobile API**.
`Authorize` tugmasi orqali `accessToken` kiritiladi.

---

## Microservices

| Servis | Port (ichki) | Baza | Vazifasi | Eventlar |
| --- | --- | --- | --- | --- |
| api | 3000 | bus_core | Core business, RBAC, gateway, WebSocket | publish: booking.*, ticket.*, trip.*, seat.*, audit.log · consume: payment.*, notification.created |
| notification-service | 3101 | bus_notification | IN_APP/PUSH/SMS, preferences, unread | consume: booking.*, payment.*, trip.*, ticket.created, notification.send · publish: notification.created, sms.send |
| sms-service | 3102 | Redis | OTP, mock SMS, outbox | consume: sms.send · publish: otp.requested, otp.verified |
| audit-service | 3103 | bus_audit | Action history, filtrlar | consume: audit.log |
| tracking-service | 3104 | bus_tracking + Redis | joriy joylashuv, tarix, ETA, online/offline | publish: Redis `tracking:location`, tracking.location.updated · consume: trip.completed/cancelled |
| payment-service | 3105 | bus_payment | to'lovlar, mock provider, refund, timeout | publish: payment.created/succeeded/failed/refunded |
| scheduler-service | 3106 | Redis (BullMQ) | rejalashtirilgan vazifalar | — (internal HTTP) |
| reporting-service | 3107 | bus_reporting | read model, agregatsiyalar, kunlik hisobot | consume: booking.*, trip.*, payment.* |

Scheduler vazifalari: `seat-lock-expiration` (30s), `booking-expiration` (60s), `payment-timeout` (60s),
`trip-reminder` (5m), `trip-status-update` (60s), `delayed-trip-check` (2m), `daily-report` (00:10), `cleanup` (03:30).

Search, file va ticket-verification alohida servis qilinmagan: qidiruv PostgreSQL indekslari bilan Main API ichida,
QR tekshiruv chipta biznes-logikasi bilan bir joyda (tranzaksion `UPDATE ... WHERE status='ACTIVE'`).

---

## RabbitMQ

* Exchange: `bus.events` (topic, durable). Routing key = event nomi (`booking.confirmed`).
* Har bir servis: `<service>.events` (asosiy), `<service>.retry` (TTL 5s → qaytadan asosiy navbatga), `<service>.dlq` (dead letter).
* Xatolikda 5 marta qayta urinish, keyin DLQ. Publisher confirm channel ishlatadi, persistent xabarlar.
* Envelope: `{ id, type, source, correlationId, occurredAt, payload }`.

---

## Redis

| Kalit | Maqsad |
| --- | --- |
| `seat-lock:{tripId}:{seatId}` | O'rindiqni vaqtincha band qilish (SET NX EX, TTL = `booking.seatLockTtlSec`) |
| `otp:{phone}`, `otp:cooldown:{phone}`, `otp:hourly:{phone}`, `otp:verified:{phone}` | OTP |
| `refresh:{sha256}` | Refresh token (rotation) |
| `auth:user:{id}`, `settings:all`, `trip-info:{id}` | Qisqa muddatli cache |
| `tracking:current:{tripId}`, `tracking:active`, kanal `tracking:location` | Real-time tracking |
| `bull:scheduler:*`, `scheduler:runs` | BullMQ va job statistikasi |
| `throttler:*` | Rate limiting |

---

## Testing

```bash
npm test                                  # unit testlar (API, OTP)
bash scripts/test-integration.sh          # Postgres/Redis'ni docker'da ko'tarib, integration testlar
```

Qamrab olingan stsenariylar: authentication (parol, OTP, refresh rotation), OTP (cooldown, urinishlar, muddat),
seat locking, **2 user bir xil o'rindiqni bir vaqtda tanlaganda double booking bo'lmasligi**, DB darajasidagi unique index,
booking creation (segment narxi), booking cancellation (refund + o'rindiq bo'shashi), payment success (idempotent tasdiq + chiptalar),
payment failure (ACTIVE chipta berilmaydi), payment timeout, ticket generation, QR verification (VALID → ALREADY_USED, parallel skan,
soxta token, boshqa haydovchi), trip creation (avtobus to'qnashuvi, nofaol avtobus), trip cancel, driver tracking cheklovi, RBAC.

---

## Demo accounts

| Rol | Login | Parol |
| --- | --- | --- |
| Super admin | `+998900000001` / `superadmin@busline.uz` | `Admin123!` |
| Admin | `+998900000002` / `admin@busline.uz` | `Admin123!` |
| Dispetcher | `+998900000003` | `Dispatch123!` |
| Haydovchi (yo'ldagi qatnov, tracking) | `+998900000011` | `Driver123!` |
| Haydovchi ("chiqish" holatidagi qatnov, QR) | `+998900000012` | `Driver123!` |
| Haydovchilar | `+998900000013` … `+998900000015` | `Driver123!` |
| Yo'lovchilar | `+998900000021` … `+998900000024` | `Passenger123!` |

OTP orqali kirishda istalgan yangi raqam ishlaydi — kod `sms-service` logida (`[MOCK SMS]`) va demo rejimida ekranda ko'rinadi.

---

## API structure

```text
/api/auth/*            login, register, otp/send, otp/verify, refresh, logout, me
/api/users, /roles, /permissions
/api/drivers, /passengers, /responsibles, /settings
/api/buses, /buses/:id/seats, /buses/:id/layout
/api/stops, /routes, /pricing
/api/trips, /trips/search, /trips/:id/seats, /trips/:id/seats/:seatId/lock
/api/trips/:id/{boarding,start,delay,complete,cancel,passengers}
/api/bookings, /bookings/:id/{pay,cancel}
/api/payments, /payments/:id/mock/complete
/api/tickets, /tickets/my, /tickets/verify
/api/notifications/*, /tracking/*, /reports/*, /audit
/api/driver/*          haydovchi web paneli
/api/mobile/*          Mobile API
/api/health, /health/services
```

Xatolik formati (Accept-Language: uz | ru | en):

```json
{ "statusCode": 409, "code": "SEAT_LOCKED_BY_OTHER", "message": "O‘rindiqni boshqa yo‘lovchi tanlagan", "correlationId": "…" }
```

WebSocket (`/socket.io`, `auth.token`): `trip:subscribe` → `seat.updated`, `trip.updated`, `vehicle.location.updated`;
`tracking:subscribe` (xodimlar); shaxsiy xona → `notification.created`, `booking.updated`.

---

## Mobile API

Alohida mobil ilova yozilmagan, faqat endpointlar (`/api/mobile`, Swagger'da **Mobile API** tagi):

```text
POST /api/mobile/auth/send-otp            POST /api/mobile/auth/verify-otp
POST /api/mobile/auth/refresh             GET  /api/mobile/auth/me
GET  /api/mobile/routes                   GET  /api/mobile/trips?from=&to=&date=
GET  /api/mobile/trips/:id                GET  /api/mobile/trips/:id/seats
POST /api/mobile/trips/:id/seats/:seatId/lock
POST /api/mobile/bookings                 GET  /api/mobile/bookings
POST /api/mobile/bookings/:id/pay         POST /api/mobile/bookings/:id/cancel
POST /api/mobile/payments/:id/mock/complete
GET  /api/mobile/tickets                  GET  /api/mobile/tickets/:id
GET  /api/mobile/notifications            GET  /api/mobile/tracking/:tripId

POST /api/mobile/driver/location          GET  /api/mobile/driver/trips
POST /api/mobile/driver/trips/:id/start   POST /api/mobile/driver/trips/:id/finish
POST /api/mobile/driver/tickets/verify    GET  /api/mobile/driver/trips/:id/passengers
```

---

## Tracking

```text
Driver (web/mobile) ─POST /api/tracking/location─► Main API
   (faqat biriktirilgan va BOARDING/IN_PROGRESS/DELAYED qatnov uchun)
        └─internal HTTP─► tracking-service ─► Redis (joriy holat + pub/sub) ─► Main API WebSocket ─► yo'lovchi / dispetcher / admin
                                         └─► PostgreSQL (tarix, batch insert) + tracking.location.updated (RabbitMQ)
```

Haydovchi panelida "Simulyatsiya" rejimi marshrut bo'ylab nuqtalarni har 3 soniyada yuboradi (GPS bo'lmasa ham demo ishlaydi).
Yo'lovchi `/trip/:id` sahifasida, dispetcher `/dispatcher/tracking` da avtobusni, tezlikni, qolgan masofani va ETA ni ko'radi.

---

## Deployment

1. Serverga Docker o'rnating, repozitoriyni klon qiling.
2. `.env` yarating (`.env.example` asosida), secret'larni almashtiring.
3. `docker compose up --build -d`
4. `docker compose ps` — barcha servislar `healthy` bo'lishi kerak.
5. Reverse proxy (TLS) orqali `frontend:80` ni tashqariga chiqaring; API `/api` orqali shu domen ostida ishlaydi.

Yangilash: `git pull && docker compose up --build -d` (migratsiyalar avtomatik).
