import { Lang } from '@bus/types';

type Dict = Record<string, Record<Lang, string>>;

export const ErrorMessages: Dict = {
  INTERNAL_ERROR: {
    uz: 'Ichki server xatosi',
    ru: 'Внутренняя ошибка сервера',
    en: 'Internal server error',
  },
  VALIDATION_ERROR: {
    uz: "Ma'lumotlar noto'g'ri kiritilgan",
    ru: 'Ошибка валидации данных',
    en: 'Validation failed',
  },
  NOT_FOUND: { uz: 'Topilmadi', ru: 'Не найдено', en: 'Not found' },
  UNAUTHORIZED: { uz: 'Avtorizatsiyadan o‘tilmagan', ru: 'Требуется авторизация', en: 'Unauthorized' },
  FORBIDDEN: { uz: 'Ruxsat yo‘q', ru: 'Доступ запрещен', en: 'Forbidden' },
  TOO_MANY_REQUESTS: {
    uz: "So'rovlar soni juda ko'p",
    ru: 'Слишком много запросов',
    en: 'Too many requests',
  },
  INVALID_CREDENTIALS: {
    uz: 'Login yoki parol noto‘g‘ri',
    ru: 'Неверный логин или пароль',
    en: 'Invalid login or password',
  },
  USER_BLOCKED: { uz: 'Foydalanuvchi bloklangan', ru: 'Пользователь заблокирован', en: 'User is blocked' },
  USER_EXISTS: {
    uz: 'Bu telefon raqam allaqachon ro‘yxatdan o‘tgan',
    ru: 'Этот номер уже зарегистрирован',
    en: 'Phone number already registered',
  },
  INVALID_PHONE: { uz: 'Telefon raqam noto‘g‘ri', ru: 'Неверный номер телефона', en: 'Invalid phone number' },
  INVALID_REFRESH_TOKEN: {
    uz: 'Sessiya muddati tugagan',
    ru: 'Сессия истекла',
    en: 'Session expired',
  },
  OTP_INVALID: { uz: 'Tasdiqlash kodi noto‘g‘ri', ru: 'Неверный код подтверждения', en: 'Invalid verification code' },
  OTP_EXPIRED: {
    uz: 'Tasdiqlash kodi muddati tugagan',
    ru: 'Срок действия кода истек',
    en: 'Verification code expired',
  },
  OTP_ATTEMPTS_EXCEEDED: {
    uz: 'Urinishlar soni tugadi, yangi kod so‘rang',
    ru: 'Превышено число попыток, запросите новый код',
    en: 'Too many attempts, request a new code',
  },
  OTP_COOLDOWN: {
    uz: 'Yangi kodni biroz keyinroq so‘rang',
    ru: 'Повторный код можно запросить позже',
    en: 'Please wait before requesting a new code',
  },
  OTP_NOT_VERIFIED: {
    uz: 'Telefon raqam tasdiqlanmagan',
    ru: 'Номер телефона не подтвержден',
    en: 'Phone number is not verified',
  },
  SERVICE_UNAVAILABLE: {
    uz: 'Xizmat vaqtincha ishlamayapti',
    ru: 'Сервис временно недоступен',
    en: 'Service temporarily unavailable',
  },
  BUS_NOT_FOUND: { uz: 'Avtobus topilmadi', ru: 'Автобус не найден', en: 'Bus not found' },
  BUS_PLATE_EXISTS: {
    uz: 'Bu davlat raqamli avtobus mavjud',
    ru: 'Автобус с таким номером уже существует',
    en: 'Bus with this plate number already exists',
  },
  BUS_HAS_TRIPS: {
    uz: 'Avtobusga faol qatnovlar biriktirilgan',
    ru: 'У автобуса есть активные рейсы',
    en: 'Bus has active trips',
  },
  INVALID_LAYOUT: { uz: 'O‘rindiqlar sxemasi noto‘g‘ri', ru: 'Неверная схема мест', en: 'Invalid seat layout' },
  DUPLICATE_SEAT_NUMBER: {
    uz: 'O‘rindiq raqamlari takrorlangan',
    ru: 'Номера мест повторяются',
    en: 'Duplicate seat numbers',
  },
  ROUTE_NOT_FOUND: { uz: 'Yo‘nalish topilmadi', ru: 'Маршрут не найден', en: 'Route not found' },
  STOP_NOT_FOUND: { uz: 'Bekat topilmadi', ru: 'Остановка не найдена', en: 'Stop not found' },
  STOP_IN_USE: {
    uz: 'Bekat yo‘nalishlarda ishlatilmoqda',
    ru: 'Остановка используется в маршрутах',
    en: 'Stop is used by routes',
  },
  ROUTE_CODE_EXISTS: {
    uz: 'Bu kodli yo‘nalish mavjud',
    ru: 'Маршрут с таким кодом уже существует',
    en: 'Route code already exists',
  },
  ROUTE_HAS_TRIPS: {
    uz: 'Yo‘nalishda qatnovlar mavjud',
    ru: 'У маршрута есть рейсы',
    en: 'Route has trips',
  },
  INVALID_ROUTE_STOPS: {
    uz: 'Yo‘nalish bekatlari noto‘g‘ri',
    ru: 'Неверные остановки маршрута',
    en: 'Invalid route stops',
  },
  TRIP_NOT_FOUND: { uz: 'Qatnov topilmadi', ru: 'Рейс не найден', en: 'Trip not found' },
  TRIP_NOT_BOOKABLE: {
    uz: 'Bu qatnovga chipta sotib bo‘lmaydi',
    ru: 'На этот рейс нельзя забронировать билет',
    en: 'Trip is not available for booking',
  },
  TRIP_INVALID_STATUS: {
    uz: 'Qatnov holati bu amalga ruxsat bermaydi',
    ru: 'Статус рейса не позволяет выполнить действие',
    en: 'Trip status does not allow this action',
  },
  BUS_BUSY: {
    uz: 'Avtobus bu vaqtda boshqa qatnovda',
    ru: 'Автобус занят в это время',
    en: 'Bus is busy at this time',
  },
  DRIVER_BUSY: {
    uz: 'Haydovchi bu vaqtda boshqa qatnovda',
    ru: 'Водитель занят в это время',
    en: 'Driver is busy at this time',
  },
  BUS_INACTIVE: { uz: 'Avtobus faol emas', ru: 'Автобус неактивен', en: 'Bus is not active' },
  BUS_HAS_NO_SEATS: {
    uz: 'Avtobusda o‘rindiqlar yo‘q',
    ru: 'В автобусе нет мест',
    en: 'Bus has no seats',
  },
  DRIVER_NOT_FOUND: { uz: 'Haydovchi topilmadi', ru: 'Водитель не найден', en: 'Driver not found' },
  DRIVER_NOT_ASSIGNED: {
    uz: 'Haydovchi bu qatnovga biriktirilmagan',
    ru: 'Водитель не назначен на этот рейс',
    en: 'Driver is not assigned to this trip',
  },
  SEAT_NOT_FOUND: { uz: 'O‘rindiq topilmadi', ru: 'Место не найдено', en: 'Seat not found' },
  SEAT_NOT_AVAILABLE: {
    uz: 'O‘rindiq band',
    ru: 'Место недоступно',
    en: 'Seat is not available',
  },
  SEAT_LOCKED_BY_OTHER: {
    uz: 'O‘rindiqni boshqa yo‘lovchi tanlagan',
    ru: 'Место выбрано другим пассажиром',
    en: 'Seat is locked by another passenger',
  },
  SEAT_LOCK_LIMIT: {
    uz: 'Bir vaqtda juda ko‘p o‘rindiq tanlandi',
    ru: 'Выбрано слишком много мест',
    en: 'Too many seats locked',
  },
  SEAT_LOCK_REQUIRED: {
    uz: 'Avval o‘rindiqni tanlang',
    ru: 'Сначала выберите место',
    en: 'Lock the seat first',
  },
  PRICE_NOT_FOUND: {
    uz: 'Narx topilmadi',
    ru: 'Цена не найдена',
    en: 'Price not found',
  },
  INVALID_SEGMENT: {
    uz: 'Bekatlar oralig‘i noto‘g‘ri',
    ru: 'Неверный участок маршрута',
    en: 'Invalid route segment',
  },
  BOOKING_NOT_FOUND: { uz: 'Bron topilmadi', ru: 'Бронь не найдена', en: 'Booking not found' },
  BOOKING_INVALID_STATUS: {
    uz: 'Bron holati bu amalga ruxsat bermaydi',
    ru: 'Статус брони не позволяет выполнить действие',
    en: 'Booking status does not allow this action',
  },
  BOOKING_EXPIRED: { uz: 'Bron muddati tugagan', ru: 'Срок брони истек', en: 'Booking expired' },
  BOOKING_CANNOT_CANCEL: {
    uz: 'Jo‘nashga oz qolgani uchun bronni bekor qilib bo‘lmaydi',
    ru: 'Бронь нельзя отменить незадолго до отправления',
    en: 'Booking cannot be cancelled this close to departure',
  },
  PAYMENT_NOT_FOUND: { uz: 'To‘lov topilmadi', ru: 'Платеж не найден', en: 'Payment not found' },
  PAYMENT_INVALID_STATUS: {
    uz: 'To‘lov holati bu amalga ruxsat bermaydi',
    ru: 'Статус платежа не позволяет выполнить действие',
    en: 'Payment status does not allow this action',
  },
  TICKET_NOT_FOUND: { uz: 'Chipta topilmadi', ru: 'Билет не найден', en: 'Ticket not found' },
  USER_NOT_FOUND: { uz: 'Foydalanuvchi topilmadi', ru: 'Пользователь не найден', en: 'User not found' },
  ROLE_NOT_FOUND: { uz: 'Rol topilmadi', ru: 'Роль не найдена', en: 'Role not found' },
  RESPONSIBLE_NOT_FOUND: {
    uz: 'Mas’ul shaxs topilmadi',
    ru: 'Ответственное лицо не найдено',
    en: 'Responsible person not found',
  },
  TRACKING_NOT_ALLOWED: {
    uz: 'Bu qatnov uchun joylashuv yuborib bo‘lmaydi',
    ru: 'Нельзя отправлять координаты для этого рейса',
    en: 'Location updates are not allowed for this trip',
  },
};

export function translate(code: string, lang: string = Lang.UZ): string {
  const entry = ErrorMessages[code];
  if (!entry) return code;
  return entry[(lang as Lang)] ?? entry[Lang.UZ];
}

export function pickLang(header?: string | string[]): Lang {
  const raw = (Array.isArray(header) ? header[0] : header ?? '').toLowerCase();
  for (const part of raw.split(',')) {
    const code = part.trim().slice(0, 2);
    if (code === 'ru') return Lang.RU;
    if (code === 'en') return Lang.EN;
    if (code === 'uz') return Lang.UZ;
  }
  return Lang.UZ;
}
