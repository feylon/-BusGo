<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export interface MapSeat {
  id: string;
  number: string;
  row: number;
  column: number;
  type: string;
  status: string;
  lockedByMe?: boolean;
  price?: number;
}

const props = defineProps<{
  rows: number;
  cols: number;
  seats: MapSeat[];
  fixtures?: { row: number; col: number; kind: string }[];
  selected?: string[];
  interactive?: boolean;
}>();
const emit = defineEmits<{ toggle: [seat: MapSeat] }>();
const { t } = useI18n();

const grid = computed(() => {
  const cells: { key: string; seat?: MapSeat; kind?: string }[] = [];
  for (let r = 0; r < props.rows; r++) {
    for (let c = 0; c < props.cols; c++) {
      const seat = props.seats.find((s) => s.row === r && s.column === c);
      const fixture = props.fixtures?.find((f) => f.row === r && f.col === c);
      cells.push({ key: `${r}:${c}`, seat, kind: seat ? 'SEAT' : fixture?.kind });
    }
  }
  return cells;
});

function state(seat: MapSeat) {
  if (props.selected?.includes(seat.id) || seat.lockedByMe) return 'selected';
  if (seat.status === 'AVAILABLE') return 'available';
  if (seat.status === 'LOCKED') return 'locked';
  if (seat.status === 'BLOCKED') return 'blocked';
  return 'taken';
}

const classes: Record<string, string> = {
  available: 'bg-white border-teal-500 text-teal-800 hover:bg-teal-50 dark:bg-slate-900 dark:text-teal-200 dark:hover:bg-teal-900/40 cursor-pointer',
  selected: 'bg-teal-600 border-teal-700 text-white shadow-md cursor-pointer',
  locked: 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 cursor-not-allowed',
  taken: 'bg-slate-200 border-slate-300 text-slate-400 dark:bg-slate-700 dark:border-slate-600 cursor-not-allowed',
  blocked: 'bg-slate-500 border-slate-600 text-white/70 cursor-not-allowed',
};

function click(seat: MapSeat) {
  if (!props.interactive) return;
  const s = state(seat);
  if (s === 'available' || s === 'selected') emit('toggle', seat);
}
</script>

<template>
  <div class="inline-block rounded-[28px] border-4 border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900/60">
    <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 2.75rem))` }">
      <template v-for="cell in grid" :key="cell.key">
        <button
          v-if="cell.seat"
          type="button"
          class="relative flex h-11 w-11 flex-col items-center justify-center rounded-lg rounded-t-xl border-2 text-xs font-semibold transition"
          :class="classes[state(cell.seat)]"
          :title="`${t('common.seat')} ${cell.seat.number} · ${t(`seatType.${cell.seat.type}`)}${cell.seat.price ? ` · ${cell.seat.price.toLocaleString('ru-RU')}` : ''}`"
          @click="click(cell.seat)"
        >
          {{ cell.seat.number }}
          <i v-if="cell.seat.type === 'VIP'" class="pi pi-star-fill absolute -top-1.5 -right-1.5 text-[10px] text-amber-500" />
          <i v-else-if="cell.seat.type === 'ACCESSIBLE'" class="pi pi-heart-fill absolute -top-1.5 -right-1.5 text-[10px] text-sky-500" />
        </button>
        <div
          v-else-if="cell.kind === 'DRIVER'"
          class="flex h-11 w-11 items-center justify-center rounded-full border-2 border-slate-400 text-slate-500"
          :title="t('trip.driverCabin')"
        >
          <i class="pi pi-user text-sm" />
        </div>
        <div v-else-if="cell.kind === 'DOOR'" class="flex h-11 w-11 items-center justify-center text-slate-400" :title="t('trip.door')">
          <i class="pi pi-sign-in text-sm" />
        </div>
        <div v-else class="h-11 w-11" />
      </template>
    </div>
  </div>
</template>
