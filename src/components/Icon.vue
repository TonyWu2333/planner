<script setup>
defineProps({ name: { type: String, required: true } });
</script>

<script>
// 24×24 线性图标，统一 1.8 描边
const ICONS = {
  calendar: '<rect x="3.5" y="4.5" width="17" height="16" rx="3.5"/><path d="M3.5 9.5h17M8 2.8v3.4M16 2.8v3.4"/>',
  'calendar-fill': '<rect x="3.5" y="4.5" width="17" height="16" rx="3.5" fill="currentColor" fill-opacity=".14"/><path d="M3.5 9.5h17M8 2.8v3.4M16 2.8v3.4"/><circle cx="8.5" cy="14" r="1.1" fill="currentColor" stroke="none"/>',
  grid: '<rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2"/><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2"/><rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2"/><rect x="13.3" y="13.3" width="7.2" height="7.2" rx="2.2"/>',
  'grid-fill': '<rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2" fill="currentColor" fill-opacity=".14"/><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2"/><rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2"/><rect x="13.3" y="13.3" width="7.2" height="7.2" rx="2.2" fill="currentColor" fill-opacity=".14"/>',
  user: '<circle cx="12" cy="8.2" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  'user-fill': '<circle cx="12" cy="8.2" r="3.8" fill="currentColor" fill-opacity=".14"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  flag: '<path d="M5.5 21V4.5M5.5 4.5h11.5l-2.3 4 2.3 4H5.5"/>',
  repeat: '<path d="M17 2.5l3 3-3 3"/><path d="M4 11.5v-1a5 5 0 0 1 5-5h11"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5v1a5 5 0 0 1-5 5H4"/>',
  skip: '<path d="M5 6l8 6-8 6z"/><path d="M18 6v12"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  checklist: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.3 2.3 4.7-5"/>',
  note: '<path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z"/><path d="M14 3.5V8h4.5M9 13h6M9 16.5h4"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 11.6a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7M9.5 7V4.5h5V7"/>',
  'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
  'chevron-left': '<path d="M14.5 6l-6 6 6 6"/>',
  'chevron-down': '<path d="M6 9.5l6 6 6-6"/>',
  'arrow-up': '<path d="M12 19V5.5M6 11l6-6 6 6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.8v1.8M12 19.4v1.8M5.5 5.5l1.3 1.3M17.2 17.2l1.3 1.3M2.8 12h1.8M19.4 12h1.8M5.5 18.5l1.3-1.3M17.2 6.8l1.3-1.3"/>',
  sunrise: '<path d="M4 18.5h16M7 15a5 5 0 0 1 10 0M12 4v4M9.5 6.5L12 4l2.5 2.5M3.5 21.5h17"/>',
  week: '<rect x="3.5" y="4.5" width="17" height="16" rx="3.5"/><path d="M3.5 9.5h17M8 13.5h8"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  sparkle: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M10 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 5.4-1.6M3.5 3.5l17 17M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  lunar: '<path d="M14.5 3.8a8.5 8.5 0 1 0 5.7 11.6A7 7 0 0 1 14.5 3.8z"/>',
  holiday: '<path d="M12 21v-9M4.5 12a7.5 7.5 0 0 1 15 0zM12 4.5V3"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.2v.2"/>',
  bolt: '<path d="M13 2.8L5 13.5h6.5l-1 7.7 8-10.7H12z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  fire: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.9 3.1-5.9 3.9-9.8 2.3 1.4 3.4 3.6 3.6 5.6 1-.8 1.6-2 1.8-3.3 2.1 1.6 3.7 4.3 3.7 7.5 0 3.6-2.6 6.2-6.5 6.2z"/>',
  coffee: '<path d="M4.5 9.5h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM16.5 11h1.5a2.5 2.5 0 0 1 0 5h-1.8M8 3.5v2.5M12 3.5v2.5"/>',
};
export { ICONS };
</script>

<template>
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" v-html="ICONS[name]" />
</template>
