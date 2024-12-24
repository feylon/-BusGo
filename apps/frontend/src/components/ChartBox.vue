<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ChartType,
} from 'chart.js';
import { useUiStore } from '@/stores/ui';

Chart.register(LineController, BarController, DoughnutController, LineElement, BarElement, ArcElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const props = defineProps<{ type: ChartType; data: ChartData | any; options?: ChartOptions | any; height?: number }>();
const canvas = ref<HTMLCanvasElement>();
const ui = useUiStore();
let chart: Chart | null = null;

function render() {
  chart?.destroy();
  if (!canvas.value) return;
  const grid = ui.dark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.06)';
  const text = ui.dark ? '#cbd5e1' : '#475569';
  chart = new Chart(canvas.value, {
    type: props.type,
    data: props.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: text, boxWidth: 12 } } },
      scales:
        props.type === 'doughnut'
          ? {}
          : { x: { grid: { color: grid }, ticks: { color: text } }, y: { grid: { color: grid }, ticks: { color: text }, beginAtZero: true } },
      ...props.options,
    } as ChartOptions,
  });
}

onMounted(render);
watch(() => [props.data, props.options, ui.dark], render, { deep: true });
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <div :style="{ height: `${height ?? 280}px` }" class="relative w-full">
    <canvas ref="canvas" />
  </div>
</template>
