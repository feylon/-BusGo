<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const items = [
  { key: 'available', cls: 'bg-white border-teal-500 dark:bg-slate-900' },
  { key: 'selected', cls: 'bg-teal-600 border-teal-700' },
  { key: 'locked', cls: 'bg-amber-100 border-amber-400' },
  { key: 'taken', cls: 'bg-slate-200 border-slate-300 dark:bg-slate-700' },
  { key: 'blocked', cls: 'bg-slate-500 border-slate-600' },
];
</script>

<template>
  <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs">
    <div v-for="i in items" :key="i.key" class="flex items-center gap-1.5">
      <span class="inline-block h-4 w-4 rounded border-2" :class="i.cls" />
      <span class="muted">{{ t(`trip.legend.${i.key}`) }}</span>
    </div>
    <div class="flex items-center gap-1.5"><i class="pi pi-star-fill text-[10px] text-amber-500" /><span class="muted">VIP</span></div>
  </div>
</template>
