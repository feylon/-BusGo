import { useI18n } from 'vue-i18n';

const TZ = 'Asia/Tashkent';
const localeOf = (lang: string) => (lang === 'en' ? 'en-GB' : 'ru-RU');
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UZ_DAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

function tashkentParts(v: string | Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(new Date(v));
  const g = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: g('year'),
    month: Number(g('month')) - 1,
    day: g('day').padStart(2, '0'),
    hour: g('hour').replace(/^24$/, '00'),
    minute: g('minute'),
    second: g('second'),
    weekday: days.indexOf(g('weekday')),
  };
}

export function useFormat() {
  const { t, locale } = useI18n();

  const money = (v?: number | string | null) =>
    `${Number(v ?? 0)
      .toLocaleString('ru-RU')
      .replace(/ /g, ' ')} ${t('common.sum')}`;

  const number = (v?: number | string | null) => Number(v ?? 0).toLocaleString('ru-RU').replace(/ /g, ' ');

  const dt = (v?: string | Date | null, opts: Intl.DateTimeFormatOptions = {}) => {
    if (v && locale.value === 'uz') {
      const p = tashkentParts(v);
      return `${p.day} ${UZ_MONTHS[p.month].slice(0, 3)}${opts.year ? ` ${p.year}` : ''}, ${p.hour}:${p.minute}${opts.second ? `:${p.second}` : ''}`;
    }
    return v
      ? new Intl.DateTimeFormat(localeOf(locale.value), {
          timeZone: TZ,
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          ...opts,
        }).format(new Date(v))
      : '—';
  };

  const date = (v?: string | Date | null) => {
    if (v && locale.value === 'uz') {
      const p = tashkentParts(v);
      return `${p.day} ${UZ_MONTHS[p.month]} ${p.year}`;
    }
    return v ? new Intl.DateTimeFormat(localeOf(locale.value), { timeZone: TZ, day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(v)) : '—';
  };

  const time = (v?: string | Date | null) =>
    v ? new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '—';

  const weekday = (v?: string | Date | null) => {
    if (v && locale.value === 'uz') {
      const p = tashkentParts(v);
      return `${UZ_DAYS[p.weekday]}, ${p.day} ${UZ_MONTHS[p.month].slice(0, 3)}`;
    }
    return v ? new Intl.DateTimeFormat(localeOf(locale.value), { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(v)) : '—';
  };

  const duration = (min?: number | null) => {
    if (min === null || min === undefined) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h} ${t('common.hours')} ${m ? `${m} ${t('common.minutes')}` : ''}`.trim() : `${m} ${t('common.minutes')}`;
  };

  const phone = (p?: string | null) => {
    if (!p) return '—';
    const d = p.replace(/\D/g, '');
    if (d.length !== 12) return p;
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  };

  const localized = (v?: Record<string, string> | null) => (v ? v[locale.value] ?? v.uz ?? Object.values(v)[0] : '');

  return { money, number, dt, date, time, weekday, duration, phone, localized, t, locale };
}

export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function isoDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

export function toLocalInput(v: string | Date) {
  const d = new Date(v);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (k: string) => parts.find((p) => p.type === k)?.value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}

export function fromLocalInput(v: string) {
  return new Date(`${v}:00+05:00`).toISOString();
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
