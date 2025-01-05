<script setup lang="ts">
defineProps<{ label: string; value: string | number; icon: string; tone?: 'teal' | 'blue' | 'amber' | 'rose' | 'violet' | 'slate'; hint?: string }>();

const tones: Record<string, string> = {
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};
</script>

<template>
  <div class="card flex items-center gap-4 p-4">
    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" :class="tones[tone ?? 'teal']">
      <i :class="['pi', icon]" class="text-xl" />
    </div>
    <div class="min-w-0">
      <div class="muted truncate text-sm">{{ label }}</div>
      <div class="text-xl leading-tight font-semibold tracking-tight whitespace-nowrap 2xl:text-2xl">{{ value }}</div>
      <div v-if="hint" class="muted text-xs">{{ hint }}</div>
    </div>
  </div>
</template>
