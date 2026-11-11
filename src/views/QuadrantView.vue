<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import Icon from '../components/Icon.vue';
import TaskRow from '../components/TaskRow.vue';
import { state, toggleDone, updateTask, findTask } from '../lib/store.js';
import { today, addDays, mondayOf } from '../lib/date.js';
import { QUADRANTS, quadrantOf, quadrantFlags, byDate } from '../lib/quadrant.js';
import { nextOccurrence, instanceOf } from '../lib/repeat.js';
import { haptic, clickGuard, toast } from '../lib/ui.js';

const emit = defineEmits(['open', 'add']);

const RANGES = [
  ['all', '全部'],
  ['today', '今天'],
  ['week', '本周'],
];
const range = ref('all');
const showDone = ref(false);
const rangeIndex = computed(() => RANGES.findIndex(([k]) => k === range.value));

function inRange(t) {
  if (range.value === 'all' || !t.date) return true; // 没日期的任务任何范围都显示
  if (range.value === 'today') return t.date <= today(); // 含已过期
  return t.date <= addDays(mondayOf(today()), 6);
}

const groups = computed(() => {
  const g = { 1: [], 2: [], 3: [], 4: [] };
  for (const raw of state.tasks) {
    // 重复任务只显示今天（或下一次）那一个实例
    let t = raw;
    if (raw.repeat) {
      const d = nextOccurrence(raw, today());
      if (!d) continue;
      t = instanceOf(raw, d);
    }
    if ((showDone.value || !t.done) && inRange(t)) g[quadrantOf(t)].push(t);
  }
  for (const k in g) g[k].sort(byDate);
  return g;
});
const openCount = (q) => groups.value[q].filter((t) => !t.done).length;

const EMPTY = { 1: '没有需要马上处理的事', 2: '规划一些长期重要的事', 3: '没有打扰你的琐事', 4: '清清爽爽' };

// ---- 长按拖拽到其他象限 ----
const grid = ref(null);
const draggingId = ref(null);
const dropQ = ref(0);
let press = null;
let ghost = null;
let off = { x: 0, y: 0 };

function onDown(e) {
  const row = e.target.closest('[data-task-id]');
  if (!row || e.target.closest('.check')) return;
  press = { x: e.clientX, y: e.clientY, row, timer: setTimeout(() => startDrag(), 340) };
}
function cancelPress() {
  if (press) clearTimeout(press.timer);
  press = null;
}
function startDrag() {
  const { row, x, y } = press;
  press = null;
  const r = row.getBoundingClientRect();
  off = { x: x - r.left, y: y - r.top };
  ghost = row.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = r.width + 'px';
  document.body.append(ghost);
  draggingId.value = row.dataset.taskId;
  moveGhost(x, y);
  requestAnimationFrame(() => ghost?.classList.add('lifted'));
  haptic.medium();
}
function moveGhost(x, y) {
  ghost.style.transform = `translate3d(${x - off.x}px, ${y - off.y}px, 0)`;
  const card = document.elementFromPoint(x, y)?.closest('.qcard');
  const q = card ? Number(card.dataset.q) : 0;
  if (q !== dropQ.value) {
    dropQ.value = q;
    if (q) haptic.select();
  }
}
function endDrag() {
  const id = draggingId.value;
  const q = dropQ.value;
  const g = ghost;
  ghost = null;
  draggingId.value = null;
  dropQ.value = 0;
  clickGuard.until = Date.now() + 300;
  g.classList.remove('lifted');
  g.classList.add('dropping');
  setTimeout(() => g.remove(), 180);
  const t = findTask(id);
  if (t && q && q !== quadrantOf(t)) {
    const before = quadrantOf(t);
    updateTask(id, quadrantFlags(q));
    haptic.success();
    toast(`已移到「${QUADRANTS[q].name}」`, { action: () => updateTask(id, quadrantFlags(before)) });
  }
}
const onMove = (e) => {
  if (draggingId.value) moveGhost(e.clientX, e.clientY);
  else if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelPress();
};
const onUp = () => (draggingId.value ? endDrag() : cancelPress());
const blockScroll = (e) => draggingId.value && e.preventDefault();
const blockMenu = (e) => e.target.closest('[data-task-id]') && e.preventDefault();

onMounted(() => {
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  grid.value.addEventListener('touchmove', blockScroll, { passive: false });
  grid.value.addEventListener('contextmenu', blockMenu);
});
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
});
</script>

<template>
  <div class="quadview">
    <header class="page-header">
      <h1>四象限</h1>
      <button class="chip press" :class="{ on: showDone }" @click="showDone = !showDone">
        <Icon :name="showDone ? 'eye' : 'eye-off'" />已完成
      </button>
    </header>

    <div class="seg-wrap">
      <div class="seg">
        <i class="seg-thumb" :style="{ transform: `translateX(${rangeIndex * 100}%)` }" />
        <button v-for="[k, v] in RANGES" :key="k" :class="{ on: range === k }" @click="range = k; haptic.select()">{{ v }}</button>
      </div>
    </div>

    <div ref="grid" class="qgrid" :class="{ dragging: draggingId }" @pointerdown="onDown">
      <section
        v-for="q in [1, 2, 3, 4]"
        :key="q"
        class="qcard"
        :class="['q' + q, { over: dropQ === q && draggingId }]"
        :data-q="q"
      >
        <header class="qc-head">
          <b class="qc-name">{{ QUADRANTS[q].name }}</b>
          <span v-if="openCount(q)" class="qc-count num">{{ openCount(q) }}</span>
          <button class="qc-add press" :aria-label="`在${QUADRANTS[q].name}里新建`" @click="emit('add', { q, date: today() })">
            <Icon name="plus" />
          </button>
        </header>
        <div class="qc-list scroll">
          <TransitionGroup tag="div" name="list" class="qc-items">
            <TaskRow
              v-for="t in groups[q]"
              :key="t.id"
              :task="t"
              compact
              show-date
              :swipe="false"
              :class="{ 'is-dragging': draggingId === t.id }"
              @toggle="toggleDone(t.id, t.occ)"
              @open="emit('open', t.id, t.occ)"
            />
          </TransitionGroup>
          <Transition name="fade">
            <div v-if="!groups[q].length" class="qc-empty"><span>{{ QUADRANTS[q].hint }}</span>{{ EMPTY[q] }}</div>
          </Transition>
        </div>
      </section>
    </div>
    <p class="qtip">长按任务拖到其他象限 · 点击查看详情</p>
  </div>
</template>

<style>
.quadview { height: 100%; display: flex; flex-direction: column; }
.quadview .page-header { align-items: center; }
.seg-wrap { padding: 0 16px 12px; }
.seg { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); padding: 3px; border-radius: 12px; background: var(--fill); }
.seg button { position: relative; z-index: 1; height: 32px; font-size: 14px; color: var(--text-2); transition: color .25s; }
.seg button.on { color: var(--text); font-weight: 600; }
.seg-thumb { position: absolute; top: 3px; left: 3px; bottom: 3px; width: calc((100% - 6px) / 3); border-radius: 9px; background: var(--surface); box-shadow: var(--shadow-1), 0 2px 6px rgba(0,0,0,.06); transition: transform .35s var(--ease); }

.qgrid { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 10px; padding: 0 12px; }
.qcard {
  min-width: 0; min-height: 0; display: flex; flex-direction: column; border-radius: var(--r-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
  transition: transform .3s var(--ease), box-shadow .25s;
}
.qcard.over { transform: scale(1.025); box-shadow: 0 0 0 2px var(--qc), var(--shadow-2); }
.qc-head { display: flex; align-items: center; gap: 6px; padding: 10px 4px 6px 12px; }
.qc-ico { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; background: var(--qc); color: #fff; flex: none; }
.qc-ico .icon { width: 13px; height: 13px; stroke-width: 2.2; }
.qc-name { flex: 0 1 auto; min-width: 0; font-size: 14.5px; font-weight: 650; color: var(--qc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qc-count { flex: none; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: var(--qc); background: var(--qsoft); }
.qc-add { flex: none; margin-left: auto; width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; color: var(--text-3); }
.qc-add:active { background: var(--fill); color: var(--qc); }
.qc-add .icon { width: 18px; height: 18px; stroke-width: 2.2; }
.qc-list { flex: 1; min-height: 0; position: relative; padding: 0 5px 10px; -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 16px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 16px), transparent); }
.qc-items { position: relative; display: flex; flex-direction: column; gap: 1px; }
.qc-empty { position: absolute; inset: 0 8px 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; font-size: 12px; color: var(--text-3); }
.qc-empty span { font-size: 13px; font-weight: 600; color: var(--qc); opacity: .7; }
.trow.is-dragging { opacity: .35; }
.qgrid.dragging .qcard:not(.over) { opacity: .92; }
.qtip { text-align: center; font-size: 11.5px; color: var(--text-3); margin: 10px 0 12px; }

/* 拖拽中的浮起卡片 */
.drag-ghost {
  position: fixed; left: 0; top: 0; z-index: 90; pointer-events: none; will-change: transform;
}
.drag-ghost .trow-main { background: var(--surface); transition: transform .22s var(--spring), box-shadow .22s; }
.drag-ghost.lifted .trow-main { transform: scale(1.05) rotate(1.5deg); box-shadow: 0 16px 36px rgba(16, 24, 40, .22); }
.drag-ghost.dropping { transition: opacity .18s; opacity: 0; }
</style>
