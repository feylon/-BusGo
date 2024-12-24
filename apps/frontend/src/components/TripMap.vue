<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';

export interface MapStop {
  name?: string;
  latitude: number;
  longitude: number;
}

export interface MapVehicle {
  tripId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  online?: boolean;
  label?: string;
  popup?: string;
}

const props = defineProps<{
  stops?: MapStop[];
  routes?: { tripId: string; stops: MapStop[] }[];
  vehicles?: MapVehicle[];
  trail?: { latitude: number; longitude: number }[];
  height?: string;
  follow?: boolean;
  focus?: string | null;
}>();
const emit = defineEmits<{ select: [tripId: string]; pick: [lat: number, lng: number] }>();

const el = ref<HTMLDivElement>();
let map: L.Map | null = null;
const layers = L.layerGroup();
const markers = new Map<string, L.Marker>();
let trailLine: L.Polyline | null = null;
let fitted = false;

const COLORS = ['#0f766e', '#2563eb', '#9333ea', '#ea580c', '#db2777', '#0891b2', '#65a30d'];

function busIcon(v: MapVehicle) {
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="bus-marker ${v.online === false ? 'offline' : ''}" style="width:36px;height:36px"><i class="pi pi-car" style="font-size:15px;transform:rotate(${(v.heading ?? 0) - 90}deg)"></i></div>`,
  });
}

function stopIcon(index: number, total: number) {
  const edge = index === 0 || index === total - 1;
  return L.divIcon({
    className: '',
    iconSize: edge ? [16, 16] : [12, 12],
    iconAnchor: edge ? [8, 8] : [6, 6],
    html: `<div style="width:100%;height:100%;border-radius:9999px;background:${edge ? '#0f766e' : '#fff'};border:3px solid #0f766e"></div>`,
  });
}

function drawStops() {
  if (!map) return;
  layers.clearLayers();
  const lines = props.routes ?? (props.stops?.length ? [{ tripId: 'main', stops: props.stops }] : []);
  const all: L.LatLngExpression[] = [];
  lines.forEach((r, i) => {
    const pts = r.stops.filter((s) => s.latitude && s.longitude).map((s) => [s.latitude, s.longitude] as L.LatLngTuple);
    all.push(...pts);
    L.polyline(pts, { color: COLORS[i % COLORS.length], weight: 4, opacity: 0.7, dashArray: lines.length > 1 ? '6 6' : undefined }).addTo(layers);
    r.stops.forEach((s, idx) => {
      if (!s.latitude) return;
      L.marker([s.latitude, s.longitude], { icon: stopIcon(idx, r.stops.length) })
        .bindTooltip(s.name ?? '', { direction: 'top' })
        .addTo(layers);
    });
  });
  if (all.length && !fitted) {
    map.fitBounds(L.latLngBounds(all), { padding: [30, 30] });
    fitted = true;
  }
}

function drawVehicles() {
  if (!map) return;
  const ids = new Set((props.vehicles ?? []).map((v) => v.tripId));
  for (const [id, m] of markers) {
    if (!ids.has(id)) {
      m.remove();
      markers.delete(id);
    }
  }
  for (const v of props.vehicles ?? []) {
    let m = markers.get(v.tripId);
    if (!m) {
      m = L.marker([v.latitude, v.longitude], { icon: busIcon(v), zIndexOffset: 1000 }).addTo(map);
      m.on('click', () => emit('select', v.tripId));
      markers.set(v.tripId, m);
    } else {
      m.setLatLng([v.latitude, v.longitude]);
      m.setIcon(busIcon(v));
    }
    if (v.popup) m.bindPopup(v.popup);
    if (v.label) m.bindTooltip(v.label, { permanent: false, direction: 'top' });
  }
  if (props.follow && props.vehicles?.length) {
    const v = props.vehicles[0]!;
    map.panTo([v.latitude, v.longitude], { animate: true });
  }
  if (!fitted && props.vehicles?.length && !props.stops?.length && !props.routes?.length) {
    map.fitBounds(L.latLngBounds(props.vehicles.map((v) => [v.latitude, v.longitude] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 10 });
    fitted = true;
  }
}

function drawTrail() {
  if (!map) return;
  trailLine?.remove();
  if (props.trail?.length) {
    trailLine = L.polyline(props.trail.map((p) => [p.latitude, p.longitude] as L.LatLngTuple), { color: '#f59e0b', weight: 3 }).addTo(map);
  }
}

onMounted(() => {
  map = L.map(el.value!, { zoomControl: true, attributionControl: true }).setView([41.0, 66.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  layers.addTo(map);
  map.on('click', (e: L.LeafletMouseEvent) => emit('pick', e.latlng.lat, e.latlng.lng));
  drawStops();
  drawVehicles();
  drawTrail();
  setTimeout(() => map?.invalidateSize(), 200);
});

watch(() => [props.stops, props.routes], () => { fitted = false; drawStops(); }, { deep: true });
watch(() => props.vehicles, drawVehicles, { deep: true });
watch(() => props.trail, drawTrail, { deep: true });
watch(
  () => props.focus,
  (id) => {
    const m = id ? markers.get(id) : null;
    if (m && map) map.setView(m.getLatLng(), 10, { animate: true });
  },
);

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});

defineExpose({ invalidate: () => map?.invalidateSize() });
</script>

<template>
  <div ref="el" :style="{ height: height ?? '420px' }" class="w-full" />
</template>
