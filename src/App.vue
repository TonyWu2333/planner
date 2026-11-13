<script setup>
import { ref, reactive, onMounted } from 'vue';
import { App as CapApp } from '@capacitor/app';
import Icon from './components/Icon.vue';
import QuickAdd from './components/QuickAdd.vue';
import TaskDetail from './components/TaskDetail.vue';
import SearchSheet from './components/SearchSheet.vue';
import Toast from './components/Toast.vue';
import CalendarView from './views/CalendarView.vue';
import QuadrantView from './views/QuadrantView.vue';
import RoutineView from './views/RoutineView.vue';
import MeView from './views/MeView.vue';
import { state, flush } from './lib/store.js';
import { today } from './lib/date.js';
import { haptic, handleBack } from './lib/ui.js';
import { initReminders, scheduleSync } from './lib/notify.js';

const TABS = [
  { key: 'calendar', label: '日程', icon: 'calendar' },
  { key: 'quadrant', label: '四象限', icon: 'grid' },
  { key: 'routine', label: '打卡', icon: 'repeat' },
  { key: 'me', label: '我的', icon: 'user' },
];
const tab = ref('calendar');
function setTab(k) {
  if (k === tab.value) return;
  haptic.select();
  tab.value = k;
}

const quick = reactive({ open: false, defaults: {} });
const detail = reactive({ open: false, id: null, occ: '' });
const openQuick = (defaults = {}) => Object.assign(quick, { open: true, defaults });
const openDetail = (id, occ = '') => Object.assign(detail, { open: true, id, occ });
const searchOpen = ref(false);
const openSearch = () => (searchOpen.value = true);

onMounted(() => {
  // 安卓返回键：先关弹窗，再回日程页，最后退到后台
  CapApp.addListener('backButton', () => {
    if (handleBack()) return;
    if (tab.value !== 'calendar') tab.value = 'calendar';
    else CapApp.minimizeApp();
  });
  CapApp.addListener('pause', flush);
  // 隔天再打开时，“今天”已经变了，直接刷新
  const day = today();
  CapApp.addListener('resume', () => (today() !== day ? location.reload() : scheduleSync()));
  // 点了提醒通知：打开那条任务
  initReminders((id, occ) => {
    tab.value = 'calendar';
    openDetail(id, occ);
  });
});
</script>

<template>
  <div v-if="state.ready" class="app">
    <main class="views">
      <section class="view" :class="{ active: tab === 'calendar' }">
        <CalendarView @add="openQuick" @open="openDetail" @search="openSearch" />
      </section>
      <section class="view" :class="{ active: tab === 'quadrant' }">
        <QuadrantView @add="openQuick" @open="openDetail" @search="openSearch" />
      </section>
      <section class="view" :class="{ active: tab === 'routine' }">
        <RoutineView @add="openQuick" @open="openDetail" @search="openSearch" />
      </section>
      <section class="view" :class="{ active: tab === 'me' }">
        <MeView />
      </section>
    </main>

    <nav class="tabbar">
      <button v-for="t in TABS" :key="t.key" class="tab" :class="{ on: tab === t.key }" @click="setTab(t.key)">
        <Icon :name="tab === t.key ? t.icon + '-fill' : t.icon" />
        <span>{{ t.label }}</span>
      </button>
    </nav>

    <QuickAdd :open="quick.open" :defaults="quick.defaults" @close="quick.open = false" />
    <SearchSheet :open="searchOpen" @close="searchOpen = false" @open="openDetail" />
    <TaskDetail :open="detail.open" :task-id="detail.id" :occ="detail.occ" @close="detail.open = false" />
    <Toast />
  </div>
</template>

<style>
.app { height: 100%; display: flex; flex-direction: column; max-width: 600px; margin: 0 auto; }
.views { position: relative; flex: 1; min-height: 0; }
.view { position: absolute; inset: 0; display: none; }
.view.active { display: block; animation: view-in .32s var(--ease); }
@keyframes view-in { from { opacity: 0; transform: translateY(6px); } }

.tabbar {
  flex: none; display: flex; height: calc(var(--tabbar-h) + var(--sab)); padding-bottom: var(--sab);
  background: var(--surface); box-shadow: 0 -1px 0 var(--sep);
}
.tab { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--text-3); font-size: 11px; font-weight: 500; }
.tab .icon { width: 25px; height: 25px; transition: transform .3s var(--spring); }
.tab.on { color: var(--accent); font-weight: 650; }
.tab.on .icon { transform: translateY(-1px) scale(1.06); }
.tab:active .icon { transform: scale(.88); }
</style>
