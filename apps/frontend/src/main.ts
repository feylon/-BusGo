import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip';
import App from './App.vue';
import router from './router';
import { i18n } from './i18n';
import { BusPreset } from './theme';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(PrimeVue, {
  theme: {
    preset: BusPreset,
    options: { darkModeSelector: '.app-dark', cssLayer: { name: 'primevue', order: 'theme, base, primevue' } },
  },
});
app.use(ToastService);
app.use(ConfirmationService);
app.directive('tooltip', Tooltip);
app.mount('#app');
