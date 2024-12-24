<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Message from 'primevue/message';
import Dialog from 'primevue/dialog';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { buildStandardLayout, type BusLayout, type LayoutCell } from '@bus/types';
import PageHeader from '@/components/PageHeader.vue';
import { api } from '@/api';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

type Kind = 'SEAT' | 'AISLE' | 'DRIVER' | 'DOOR' | 'EMPTY';
type Tool = Kind | 'SELECT';

const route = useRoute();
const router = useRouter();
const { t } = useFormat();
const { success, error } = useNotify();

const bus = ref<any>(null);
const rows = ref(0);
const cols = ref(0);
const cells = reactive(new Map<string, LayoutCell>());
const tool = ref<Tool>('SELECT');
const selectedKey = ref<string | null>(null);
const moving = ref(false);
const dirty = ref(false);
const saving = ref(false);
const templateDialog = ref(false);
const tpl = reactive({ rows: 12, left: 2, right: 2, vipRows: 0 });

const key = (r: number, c: number) => `${r}:${c}`;
const selected = computed(() => (selectedKey.value ? cells.get(selectedKey.value) ?? null : null));
const seatCount = computed(() => [...cells.values()].filter((c) => c.kind === 'SEAT' && c.status !== 'DISABLED').length);

const tools = computed<{ value: Tool; icon: string; label: string }[]>(() => [
  { value: 'SELECT', icon: 'pi-arrow-up-left', label: t('common.edit') },
  { value: 'SEAT', icon: 'pi-stop', label: t('seatEditor.seat') },
  { value: 'AISLE', icon: 'pi-arrows-v', label: t('seatEditor.aisle') },
  { value: 'DRIVER', icon: 'pi-user', label: t('seatEditor.driver') },
  { value: 'DOOR', icon: 'pi-sign-in', label: t('seatEditor.door') },
  { value: 'EMPTY', icon: 'pi-eraser', label: t('seatEditor.empty') },
]);
const typeOptions = computed(() => ['STANDARD', 'COMFORT', 'VIP', 'ACCESSIBLE'].map((v) => ({ label: t(`seatType.${v}`), value: v })));
const statusOptions = computed(() => ['ACTIVE', 'BLOCKED', 'DISABLED'].map((v) => ({ label: t(`status.${v}`), value: v })));

function apply(layout: BusLayout) {
  cells.clear();
  rows.value = layout.rows;
  cols.value = layout.cols;
  for (const c of layout.cells) cells.set(key(c.row, c.col), { ...c });
  selectedKey.value = null;
}

onMounted(async () => {
  try {
    bus.value = await api.buses.get(String(route.params.id));
    const layout = bus.value.layout?.rows ? bus.value.layout : buildStandardLayout(10, 2, 2);
    apply(layout);
  } catch (e) {
    error(e);
  }
});

function nextNumber() {
  const used = new Set([...cells.values()].filter((c) => c.kind === 'SEAT').map((c) => c.number));
  let n = 1;
  while (used.has(String(n).padStart(2, '0'))) n++;
  return String(n).padStart(2, '0');
}

function click(r: number, c: number) {
  const k = key(r, c);
  const cell = cells.get(k);
  dirty.value = true;
  if (tool.value === 'SELECT') {
    if (moving.value && selectedKey.value && (!cell || cell.kind !== 'SEAT')) {
      const seat = cells.get(selectedKey.value)!;
      cells.delete(selectedKey.value);
      cells.set(k, { ...seat, row: r, col: c });
      selectedKey.value = k;
      moving.value = false;
      return;
    }
    selectedKey.value = cell?.kind === 'SEAT' ? k : null;
    moving.value = false;
    return;
  }
  if (tool.value === 'SEAT') {
    if (cell?.kind === 'SEAT') selectedKey.value = k;
    else {
      cells.set(k, { row: r, col: c, kind: 'SEAT' as any, number: nextNumber(), type: 'STANDARD' as any, status: 'ACTIVE' as any });
      selectedKey.value = k;
    }
    return;
  }
  if (tool.value === 'EMPTY') cells.delete(k);
  else cells.set(k, { row: r, col: c, kind: tool.value as any });
  if (selectedKey.value === k) selectedKey.value = null;
}

function addRow() {
  rows.value++;
  dirty.value = true;
}

function removeRow() {
  if (rows.value <= 1) return;
  for (let c = 0; c < cols.value; c++) cells.delete(key(rows.value - 1, c));
  rows.value--;
  dirty.value = true;
}

function addCol() {
  if (cols.value >= 10) return;
  cols.value++;
  dirty.value = true;
}

function removeCol() {
  if (cols.value <= 1) return;
  for (let r = 0; r < rows.value; r++) cells.delete(key(r, cols.value - 1));
  cols.value--;
  dirty.value = true;
}

function renumber() {
  const seats = [...cells.values()].filter((c) => c.kind === 'SEAT').sort((a, b) => a.row - b.row || a.col - b.col);
  seats.forEach((s, i) => (s.number = String(i + 1).padStart(2, '0')));
  dirty.value = true;
}

function generate() {
  apply(buildStandardLayout(tpl.rows, tpl.left, tpl.right, { vipRows: tpl.vipRows }));
  templateDialog.value = false;
  dirty.value = true;
}

function removeSelected() {
  if (!selectedKey.value) return;
  cells.delete(selectedKey.value);
  selectedKey.value = null;
  dirty.value = true;
}

async function save() {
  saving.value = true;
  try {
    const layout = { rows: rows.value, cols: cols.value, cells: [...cells.values()].filter((c) => c.row < rows.value && c.col < cols.value) };
    bus.value = await api.buses.saveLayout(bus.value.id, layout);
    apply(bus.value.layout);
    dirty.value = false;
    success(t('common.saved'));
  } catch (e) {
    error(e);
  } finally {
    saving.value = false;
  }
}

const cellClass = (cell?: LayoutCell, k?: string) => {
  if (!cell) return 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800';
  if (cell.kind === 'SEAT') {
    const sel = k === selectedKey.value ? 'ring-2 ring-offset-2 ring-amber-500' : '';
    if (cell.status === 'BLOCKED') return `bg-slate-500 border-slate-600 text-white ${sel}`;
    if (cell.status === 'DISABLED') return `bg-slate-200 border-slate-300 text-slate-400 line-through ${sel}`;
    if (cell.type === 'VIP') return `bg-amber-50 border-amber-500 text-amber-800 ${sel}`;
    if (cell.type === 'COMFORT') return `bg-sky-50 border-sky-500 text-sky-800 ${sel}`;
    if (cell.type === 'ACCESSIBLE') return `bg-violet-50 border-violet-500 text-violet-800 ${sel}`;
    return `bg-white border-teal-500 text-teal-800 dark:bg-slate-900 dark:text-teal-200 ${sel}`;
  }
  if (cell.kind === 'AISLE') return 'border-transparent bg-slate-100 dark:bg-slate-800';
  return 'border-slate-400 text-slate-500';
};
</script>

<template>
  <div v-if="bus">
    <PageHeader :title="t('seatEditor.title')" :subtitle="`${bus.name} · ${bus.plateNumber} · ${t('seatEditor.seatsCount', { n: seatCount })}`">
      <Button :label="t('common.back')" icon="pi pi-arrow-left" text @click="router.push('/admin/buses')" />
      <Button :label="t('seatEditor.template')" icon="pi pi-th-large" outlined @click="templateDialog = true" />
      <Button :label="t('common.save')" icon="pi pi-check" :loading="saving" :disabled="!dirty" @click="save" />
    </PageHeader>
    <Message v-if="dirty" severity="warn" size="small" class="mb-4">{{ t('seatEditor.unsaved') }}</Message>

    <div class="grid gap-6 xl:grid-cols-[260px_1fr_300px]">
      <div class="card h-fit space-y-4 p-4">
        <div>
          <div class="field-label">{{ t('seatEditor.tools') }}</div>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="tl in tools"
              :key="tl.value"
              type="button"
              class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
              :class="tool === tl.value ? 'border-teal-600 bg-teal-600 text-white' : 'hover:border-teal-400'"
              style="border-color: var(--app-border)"
              @click="tool = tl.value; moving = false"
            >
              <i :class="['pi', tl.icon]" />{{ tl.label }}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="field-label col-span-2 !mb-0">{{ t('seatEditor.rows') }}: {{ rows }} · {{ t('seatEditor.cols') }}: {{ cols }}</div>
          <Button size="small" outlined icon="pi pi-plus" :label="t('seatEditor.addRow')" @click="addRow" />
          <Button size="small" outlined severity="secondary" icon="pi pi-minus" :label="t('seatEditor.removeRow')" @click="removeRow" />
          <Button size="small" outlined icon="pi pi-plus" :label="t('seatEditor.addCol')" @click="addCol" />
          <Button size="small" outlined severity="secondary" icon="pi pi-minus" :label="t('seatEditor.removeCol')" @click="removeCol" />
        </div>
        <Button class="w-full" size="small" outlined icon="pi pi-sort-numeric-down" :label="t('seatEditor.renumber')" @click="renumber" />
        <p class="muted text-xs">{{ t('seatEditor.hint') }}</p>
      </div>

      <div class="card flex justify-center overflow-x-auto p-6">
        <div class="inline-block rounded-[28px] border-4 border-slate-300 p-4 dark:border-slate-600">
          <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${cols}, 2.75rem)` }">
            <template v-for="r in rows" :key="r">
              <button
                v-for="c in cols"
                :key="`${r}-${c}`"
                type="button"
                class="relative flex h-11 w-11 items-center justify-center rounded-lg border-2 text-xs font-semibold transition"
                :class="cellClass(cells.get(key(r - 1, c - 1)), key(r - 1, c - 1))"
                @click="click(r - 1, c - 1)"
              >
                <template v-if="cells.get(key(r - 1, c - 1))?.kind === 'SEAT'">{{ cells.get(key(r - 1, c - 1))?.number }}</template>
                <i v-else-if="cells.get(key(r - 1, c - 1))?.kind === 'DRIVER'" class="pi pi-user" />
                <i v-else-if="cells.get(key(r - 1, c - 1))?.kind === 'DOOR'" class="pi pi-sign-in" />
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="card h-fit p-4">
        <h3 class="mb-3 font-semibold">{{ t('seatEditor.selected') }}</h3>
        <div v-if="selected" class="space-y-3">
          <div><label class="field-label">{{ t('seatEditor.number') }}</label><InputText v-model="selected.number" class="w-full" @input="dirty = true" /></div>
          <div><label class="field-label">{{ t('admin.seatType') }}</label><Select v-model="selected.type" :options="typeOptions" option-label="label" option-value="value" class="w-full" @change="dirty = true" /></div>
          <div><label class="field-label">{{ t('common.status') }}</label><Select v-model="selected.status" :options="statusOptions" option-label="label" option-value="value" class="w-full" @change="dirty = true" /></div>
          <div class="muted text-xs">{{ t('seatEditor.rows') }} {{ selected.row + 1 }} · {{ t('seatEditor.cols') }} {{ selected.col + 1 }}</div>
          <div class="flex gap-2">
            <Button size="small" outlined icon="pi pi-arrows-alt" :label="t('seatEditor.move')" :severity="moving ? 'warn' : undefined" @click="tool = 'SELECT'; moving = !moving" />
            <Button size="small" outlined severity="danger" icon="pi pi-trash" :label="t('common.delete')" @click="removeSelected" />
          </div>
          <Message v-if="moving" severity="info" size="small">{{ t('seatEditor.moveHint') }}</Message>
        </div>
        <p v-else class="muted text-sm">—</p>
      </div>
    </div>

    <Dialog v-model:visible="templateDialog" modal :header="t('seatEditor.template')" class="w-full max-w-sm">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="field-label">{{ t('seatEditor.rows') }}</label><InputNumber v-model="tpl.rows" :min="2" :max="20" class="w-full" /></div>
        <div><label class="field-label">{{ t('seatEditor.left') }}</label><InputNumber v-model="tpl.left" :min="1" :max="3" class="w-full" /></div>
        <div><label class="field-label">{{ t('seatEditor.right') }}</label><InputNumber v-model="tpl.right" :min="1" :max="3" class="w-full" /></div>
        <div class="col-span-2"><label class="field-label">{{ t('seatEditor.vipRows') }}</label><InputNumber v-model="tpl.vipRows" :min="0" :max="tpl.rows" class="w-full" /></div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="templateDialog = false" />
        <Button :label="t('common.apply')" @click="generate" />
      </template>
    </Dialog>
  </div>
</template>
