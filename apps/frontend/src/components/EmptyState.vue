<script setup lang="ts">
defineProps<{ icon?: string; text: string }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <div class="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
      <i :class="['pi', icon ?? 'pi-inbox']" class="muted text-2xl" />
    </div>
    <p class="muted max-w-sm text-sm">{{ text }}</p>
    <slot />
  </div>
</template>
