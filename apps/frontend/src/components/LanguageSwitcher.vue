<script setup lang="ts">
import { useUiStore, type Lang } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/api';

const ui = useUiStore();
const auth = useAuthStore();
const langs: Lang[] = ['uz', 'ru', 'en'];

function pick(l: Lang) {
  ui.lang = l;
  if (auth.isAuthenticated) api.auth.update({ lang: l }).then((u) => auth.setUser(u)).catch(() => undefined);
}
</script>

<template>
  <div class="inline-flex overflow-hidden rounded-lg border text-xs font-semibold" style="border-color: var(--app-border)">
    <button
      v-for="l in langs"
      :key="l"
      type="button"
      class="px-2.5 py-1.5 uppercase transition"
      :class="ui.lang === l ? 'bg-teal-700 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'"
      @click="pick(l)"
    >
      {{ l }}
    </button>
  </div>
</template>
