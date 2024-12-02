<script setup lang="ts">
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import { isoDate } from '@/composables/useFormat';

const props = defineProps<{ from?: string; to?: string; date?: string; passengers?: number; compact?: boolean }>();
const router = useRouter();
const { t } = useI18n();

const cities = ref<{ city: string }[]>([]);
const from = ref(props.from ?? 'Toshkent');
const to = ref(props.to ?? 'Samarqand');
const date = ref<Date>(props.date ? new Date(`${props.date}T12:00:00`) : new Date());
const passengers = ref(props.passengers ?? 1);

onMounted(async () => {
  cities.value = await api.stops.cities().catch(() => []);
});

function swap() {
  [from.value, to.value] = [to.value, from.value];
}

function submit() {
  router.push({ name: 'trips', query: { from: from.value, to: to.value, date: isoDate(date.value), passengers: passengers.value } });
}
</script>

<template>
  <form class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_200px_120px_auto] md:items-end" @submit.prevent="submit">
    <div>
      <label class="field-label">{{ t('search.from') }}</label>
      <Select v-model="from" :options="cities" option-label="city" option-value="city" filter :placeholder="t('search.selectCity')" class="w-full" />
    </div>
    <Button type="button" icon="pi pi-arrow-right-arrow-left" text rounded class="self-end justify-self-center" :aria-label="t('search.swap')" @click="swap" />
    <div>
      <label class="field-label">{{ t('search.to') }}</label>
      <Select v-model="to" :options="cities" option-label="city" option-value="city" filter :placeholder="t('search.selectCity')" class="w-full" />
    </div>
    <div>
      <label class="field-label">{{ t('search.date') }}</label>
      <DatePicker v-model="date" :min-date="new Date()" date-format="dd.mm.yy" show-icon class="w-full" />
    </div>
    <div>
      <label class="field-label">{{ t('search.passengers') }}</label>
      <InputNumber v-model="passengers" :min="1" :max="6" show-buttons button-layout="horizontal" input-class="w-12 text-center" class="w-full" />
    </div>
    <Button type="submit" :label="t('search.find')" icon="pi pi-search" class="h-[42px]" />
  </form>
</template>
