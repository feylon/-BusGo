<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import QRCode from 'qrcode';

const props = defineProps<{ value: string; size?: number }>();
const src = ref('');

watchEffect(async () => {
  src.value = props.value ? await QRCode.toDataURL(props.value, { width: props.size ?? 220, margin: 1, errorCorrectionLevel: 'M' }) : '';
});
</script>

<template>
  <img v-if="src" :src="src" :width="size ?? 220" :height="size ?? 220" alt="QR" class="rounded-lg bg-white p-2" />
</template>
