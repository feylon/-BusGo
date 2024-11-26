import { reactive, ref, watch, type Ref } from 'vue';
import type { Page } from '@/api';
import { useNotify } from './useNotify';

export function usePaged<T = any>(fetcher: (q: Record<string, any>) => Promise<Page<T>>, filters: Record<string, any> = {}, limit = 20) {
  const { error } = useNotify();
  const items = ref([]) as Ref<T[]>;
  const total = ref(0);
  const loading = ref(false);
  const page = ref(1);
  const rows = ref(limit);
  const query = reactive<Record<string, any>>({ ...filters });

  async function load() {
    loading.value = true;
    try {
      const params: Record<string, any> = { page: page.value, limit: rows.value };
      for (const [k, v] of Object.entries(query)) if (v !== '' && v !== null && v !== undefined) params[k] = v;
      const res = await fetcher(params);
      items.value = res.items;
      total.value = res.total;
    } catch (e) {
      error(e);
    } finally {
      loading.value = false;
    }
  }

  function onPage(e: { page: number; rows: number }) {
    page.value = e.page + 1;
    rows.value = e.rows;
    load();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(
    query,
    () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        page.value = 1;
        load();
      }, 300);
    },
    { deep: true },
  );

  return { items, total, loading, page, rows, query, load, onPage };
}
