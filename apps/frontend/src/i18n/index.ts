import { createI18n } from 'vue-i18n';
import uz from './uz';
import ru from './ru';
import en from './en';

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('bus.lang') || 'uz',
  fallbackLocale: 'uz',
  messages: { uz, ru, en },
  missingWarn: false,
  fallbackWarn: false,
});

export function setLocale(lang: string) {
  (i18n.global.locale as any).value = lang;
  document.documentElement.lang = lang;
}
