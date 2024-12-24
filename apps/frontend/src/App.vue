<script setup lang="ts">
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { onMounted } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';

const ui = useUiStore();
const auth = useAuthStore();

onMounted(() => {
  ui.applyTheme();
  if (auth.token) auth.fetchMe().catch(() => undefined);
});
</script>

<template>
  <Toast position="top-right" />
  <ConfirmDialog />
  <RouterView />
</template>
