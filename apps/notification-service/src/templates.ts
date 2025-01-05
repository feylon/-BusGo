import { Lang, NotificationType } from '@bus/types';

type Params = Record<string, string | number | undefined>;
type Text = Record<Lang, string>;

const T: Record<NotificationType, { title: Text; body: Text }> = {
  BOOKING_CREATED: {
    title: { uz: 'Bron yaratildi', ru: 'Бронь создана', en: 'Booking created' },
    body: {
      uz: '{route} yo‘nalishi bo‘yicha {code} broni yaratildi. To‘lovni {minutes} daqiqa ichida amalga oshiring.',
      ru: 'Бронь {code} по маршруту {route} создана. Оплатите в течение {minutes} минут.',
      en: 'Booking {code} for {route} was created. Please pay within {minutes} minutes.',
    },
  },
  BOOKING_CONFIRMED: {
    title: { uz: 'Bron tasdiqlandi', ru: 'Бронь подтверждена', en: 'Booking confirmed' },
    body: {
      uz: '{code}: {route}, {departure}. O‘rindiqlar: {seats}. Oq yo‘l!',
      ru: '{code}: {route}, {departure}. Места: {seats}. Счастливого пути!',
      en: '{code}: {route}, {departure}. Seats: {seats}. Have a nice trip!',
    },
  },
  BOOKING_CANCELLED: {
    title: { uz: 'Bron bekor qilindi', ru: 'Бронь отменена', en: 'Booking cancelled' },
    body: {
      uz: '{code} broni bekor qilindi ({route}, {departure}).',
      ru: 'Бронь {code} отменена ({route}, {departure}).',
      en: 'Booking {code} was cancelled ({route}, {departure}).',
    },
  },
  BOOKING_EXPIRED: {
    title: { uz: 'Bron muddati tugadi', ru: 'Срок брони истек', en: 'Booking expired' },
    body: {
      uz: '{code} broni to‘lov qilinmagani uchun bekor qilindi.',
      ru: 'Бронь {code} отменена из-за отсутствия оплаты.',
      en: 'Booking {code} expired because it was not paid in time.',
    },
  },
  PAYMENT_SUCCESS: {
    title: { uz: 'To‘lov qabul qilindi', ru: 'Оплата получена', en: 'Payment received' },
    body: {
      uz: '{amount} so‘m miqdoridagi to‘lov muvaffaqiyatli amalga oshirildi.',
      ru: 'Платеж на сумму {amount} сум успешно проведен.',
      en: 'Payment of {amount} UZS was successful.',
    },
  },
  PAYMENT_FAILED: {
    title: { uz: 'To‘lov amalga oshmadi', ru: 'Платеж не прошел', en: 'Payment failed' },
    body: {
      uz: '{amount} so‘m to‘lov amalga oshmadi. Qaytadan urinib ko‘ring.',
      ru: 'Платеж на {amount} сум не прошел. Попробуйте еще раз.',
      en: 'Payment of {amount} UZS failed. Please try again.',
    },
  },
  PAYMENT_REFUNDED: {
    title: { uz: 'Pul qaytarildi', ru: 'Средства возвращены', en: 'Payment refunded' },
    body: {
      uz: '{amount} so‘m hisobingizga qaytarildi.',
      ru: '{amount} сум возвращены на ваш счет.',
      en: '{amount} UZS has been refunded.',
    },
  },
  TRIP_REMINDER: {
    title: { uz: 'Safar eslatmasi', ru: 'Напоминание о поездке', en: 'Trip reminder' },
    body: {
      uz: '{route} avtobusi {departure} da jo‘naydi. Avtobus: {bus}.',
      ru: 'Автобус {route} отправляется {departure}. Автобус: {bus}.',
      en: 'Your bus {route} departs at {departure}. Bus: {bus}.',
    },
  },
  TRIP_DELAYED: {
    title: { uz: 'Qatnov kechikmoqda', ru: 'Рейс задерживается', en: 'Trip delayed' },
    body: {
      uz: '{route} ({departure}) qatnovi {minutes} daqiqaga kechikmoqda.',
      ru: 'Рейс {route} ({departure}) задерживается на {minutes} мин.',
      en: 'Trip {route} ({departure}) is delayed by {minutes} min.',
    },
  },
  TRIP_CANCELLED: {
    title: { uz: 'Qatnov bekor qilindi', ru: 'Рейс отменен', en: 'Trip cancelled' },
    body: {
      uz: '{route} ({departure}) qatnovi bekor qilindi. To‘lov qaytariladi.',
      ru: 'Рейс {route} ({departure}) отменен. Средства будут возвращены.',
      en: 'Trip {route} ({departure}) was cancelled. Your payment will be refunded.',
    },
  },
  TRIP_STARTED: {
    title: { uz: 'Qatnov boshlandi', ru: 'Рейс начался', en: 'Trip started' },
    body: {
      uz: '{route} avtobusi yo‘lga chiqdi. Xaritada kuzatishingiz mumkin.',
      ru: 'Автобус {route} отправился. Следите за ним на карте.',
      en: 'Bus {route} has departed. You can follow it on the map.',
    },
  },
  TICKET_CREATED: {
    title: { uz: 'Chipta tayyor', ru: 'Билет готов', en: 'Ticket issued' },
    body: {
      uz: '{ticket} raqamli chipta yaratildi. O‘rindiq: {seats}.',
      ru: 'Билет {ticket} оформлен. Место: {seats}.',
      en: 'Ticket {ticket} has been issued. Seat: {seats}.',
    },
  },
  SYSTEM: {
    title: { uz: '{title}', ru: '{title}', en: '{title}' },
    body: { uz: '{body}', ru: '{body}', en: '{body}' },
  },
};

const fill = (tpl: string, p: Params) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ''));

export function render(type: NotificationType, params: Params) {
  const t = T[type];
  const title = {} as Text;
  const body = {} as Text;
  for (const lang of [Lang.UZ, Lang.RU, Lang.EN]) {
    title[lang] = fill(t.title[lang], params);
    body[lang] = fill(t.body[lang], params);
  }
  return { title, body };
}

export function formatDate(iso?: string) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export const formatAmount = (n?: number) => (n ?? 0).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
