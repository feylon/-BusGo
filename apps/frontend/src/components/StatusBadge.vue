<script setup lang="ts">
import Tag from 'primevue/tag';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ status?: string | null }>();
const { t, te } = useI18n();

const severity = computed(() => {
  switch (props.status) {
    case 'ACTIVE':
    case 'CONFIRMED':
    case 'SUCCEEDED':
    case 'VALID':
    case 'AVAILABLE':
    case 'COMPLETED':
    case 'ONLINE':
      return 'success';
    case 'IN_PROGRESS':
    case 'BOARDING':
    case 'PROCESSING':
    case 'SOLD':
      return 'info';
    case 'PENDING':
    case 'DELAYED':
    case 'LOCKED':
    case 'RESERVED':
    case 'MAINTENANCE':
    case 'ON_LEAVE':
    case 'REFUND_PENDING':
    case 'ALREADY_USED':
      return 'warn';
    case 'CANCELLED':
    case 'FAILED':
    case 'INVALID':
    case 'BLOCKED':
      return 'danger';
    case 'SCHEDULED':
      return 'contrast';
    default:
      return 'secondary';
  }
});

const label = computed(() => (props.status && te(`status.${props.status}`) ? t(`status.${props.status}`) : props.status ?? '—'));
</script>

<template>
  <Tag :severity="severity" :value="label" class="whitespace-nowrap !text-xs" />
</template>
