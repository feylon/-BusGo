<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 class="page-title">{{ title }}</h1>
      <p v-if="subtitle" class="muted mt-0.5 text-sm">{{ subtitle }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
