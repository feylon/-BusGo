# Arxitektura

## Umumiy yondashuv

BusLine — **hybrid** arxitektura: tranzaksion yadro (bron, o'rindiq, chipta) bitta Main API ichida qoladi,
yuklama va mas'uliyati boshqacha bo'lgan qismlar esa alohida servislarga ajratilgan.

| Qaror | Sabab |
| --- | --- |
| Booking, seats, tickets, pricing Main API'da | Bitta PostgreSQL tranzaksiyasi, `SELECT ... FOR UPDATE` va partial unique index bilan double booking'ga qarshi kafolat. Bularni bo'lish distributed transaction (saga) talab qilardi. |
| Payment alohida | Tashqi providerlar, o'z holat mashinasi (`PENDING → PROCESSING → SUCCEEDED/FAILED → REFUNDED`), audit izi (`payment_logs`). |
| Tracking alohida | GPS so'rovlari ko'p; Redis'da joriy holat, PostgreSQL'ga batch yozish. Main API faqat avtorizatsiya va WebSocket fan-out qiladi. |
| Notification, SMS, Audit alohida | Asinxron, eventlar orqali. Main API ularning ishlashini kutmaydi. |
| Reporting alohida | Agregatsiya so'rovlari transactional bazani yuklamasligi uchun eventlardan read model quriladi. |
| Scheduler alohida | BullMQ repeatable joblar; biznes amallarini o'zi bajarmaydi, mas'ul servisning ichki endpointini chaqiradi. |
| Search / File / Ticket-verification servislari yo'q | Hozirgi hajmda overengineering. Qidiruv — PostgreSQL indekslari, QR tekshiruv — chipta bilan bir tranzaksiyada. |

## Muloqot

* **Frontend → Main API**: REST (`/api`) va Socket.IO (`/socket.io`). Microservice'lar tashqariga ochilmaydi.
* **Main API → microservice**: ichki HTTP, `x-internal-token`, `x-correlation-id`, timeout 5s, GET uchun eksponensial retry.
  Javob 5xx yoki tarmoq xatosi bo'lsa — `SERVICE_UNAVAILABLE` (503).
* **Asinxron**: RabbitMQ topic exchange `bus.events`, per-service navbatlar, retry navbati (TTL) va DLQ.
* **Real-time**: tracking-service Redis pub/sub `tracking:location` → Main API gateway → `trip:{id}` va `tracking:all` xonalari.

## Double booking himoyasi (3 qatlam)

1. **Redis lock** — `SET seat-lock:{trip}:{seat} {userId} NX EX ttl`. Boshqa foydalanuvchi `SEAT_LOCKED_BY_OTHER` oladi.
2. **Shartli UPDATE** — `UPDATE trip_seats SET status='LOCKED' WHERE status='AVAILABLE' OR (LOCKED AND (expired OR mine))`.
3. **Tranzaksiya** — bron yaratishda o'rindiqlar `FOR UPDATE` bilan qulflanadi, `booking_items` ga yoziladi;
   `UNIQUE (tripSeatId) WHERE active = true` indeksi bir o'rindiqqa ikkinchi faol bronni fizik jihatdan imkonsiz qiladi.

Integration testda ikki foydalanuvchi bir vaqtda (`Promise.allSettled`) bitta o'rindiqni bron qiladi — faqat bittasi muvaffaqiyatli bo'ladi.

## Bron hayot sikli

```text
AVAILABLE ──lock──► LOCKED ──booking──► RESERVED ──payment.succeeded──► SOLD
    ▲                 │ (TTL / unlock)     │ (timeout / cancel)
    └─────────────────┴────────────────────┘

Booking: PENDING ──paid──► CONFIRMED ──trip completed──► COMPLETED
            │                  └──cancel──► CANCELLED (+refund)
            └──timeout──► EXPIRED
Ticket:  ACTIVE ──QR──► USED      ACTIVE ──cancel──► CANCELLED      ACTIVE ──trip completed──► EXPIRED
```

* To'lov muvaffaqiyatli bo'lmaguncha ACTIVE chipta berilmaydi (`confirmPaid` ichida yaratiladi).
* `confirmPaid` idempotent: booking qatori `FOR UPDATE` bilan olinadi, holat tekshiriladi; agar bron allaqachon EXPIRED bo'lsa — avtomatik refund.
* Bekor qilingan (CANCELLED) qatnov uchun bron yaratib bo'lmaydi (`TRIP_NOT_BOOKABLE`).

## QR token

`BT1.<ticketId>.<nonce>.<hmac>` — `HMAC-SHA256(QR_SECRET, ticketId.nonce)`. Tekshiruv:
imzo → ticket mavjudligi → haydovchi shu qatnovga biriktirilganmi → holat → `UPDATE ... WHERE status='ACTIVE'`
(parallel skanerlashda ham faqat bittasi `VALID` bo'ladi, qolgani `ALREADY_USED`).

## Xavfsizlik

JWT (access 15m) + refresh token rotation (Redis, sha256), argon2 parollar, RBAC (rollar × permission'lar, guard),
Helmet, CORS, ValidationPipe (whitelist), TypeORM parametrlangan so'rovlar, Redis'da rate limit (OTP endpointlari uchun qattiqroq),
OTP: hash, TTL, cooldown, soatlik limit, urinishlar limiti, imzolangan QR, audit log (parol/kod/tokenlar `***` bilan maskalanadi),
servislararo `INTERNAL_TOKEN` (timing-safe taqqoslash).

## Resilience

Retry (HTTP GET, RabbitMQ consumer 5 marta), timeout, DLQ, idempotent consumer'lar (`processed_events`, unique `eventId`),
health check'lar (`/health` — DB/Redis/RabbitMQ), graceful shutdown (`enableShutdownHooks`, navbat/ulanishlarni yopish,
tracking buferini flush qilish), RabbitMQ qayta ulanish (eksponensial backoff).
