import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { setLocale } from '@/i18n';

export type Lang = 'uz' | 'ru' | 'en';

export const useUiStore = defineStore('ui', () => {
  const lang = ref<Lang>((localStorage.getItem('bus.lang') as Lang) || 'uz');
  const dark = ref(localStorage.getItem('bus.theme') === 'dark');
  const sidebarOpen = ref(false);

  function applyTheme() {
    document.documentElement.classList.toggle('app-dark', dark.value);
    setLocale(lang.value);
  }

  watch(lang, (v) => {
    localStorage.setItem('bus.lang', v);
    setLocale(v);
  });

  watch(dark, (v) => {
    localStorage.setItem('bus.theme', v ? 'dark' : 'light');
    applyTheme();
  });

  return { lang, dark, sidebarOpen, applyTheme };
});
