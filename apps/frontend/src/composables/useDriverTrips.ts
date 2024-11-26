import { computed, ref } from 'vue';
import { api } from '@/api';

const ACTIVE_ORDER = ['IN_PROGRESS', 'BOARDING', 'DELAYED', 'SCHEDULED'];

export function useDriverTrips() {
  const trips = ref<any[]>([]);
  const loading = ref(false);

  async function load(scope = 'today') {
    loading.value = true;
    try {
      trips.value = await api.driver.trips(scope);
    } finally {
      loading.value = false;
    }
  }

  const current = computed(() => {
    const open = trips.value.filter((t) => ACTIVE_ORDER.includes(t.status));
    return open.sort((a, b) => ACTIVE_ORDER.indexOf(a.status) - ACTIVE_ORDER.indexOf(b.status) || new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime())[0] ?? null;
  });

  return { trips, loading, load, current };
}
