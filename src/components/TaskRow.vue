<script setup>
// 一条任务：
//  · 点圆圈：勾选动画播完再真正完成（这样列表重排不会打断动画）
//  · 右滑：完成 / 取消完成；左滑：露出“推迟”“删除”
//  · compact：四象限卡片里的紧凑样式，不支持滑动（长按拖拽由父级处理）
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import { quadrantOf, isOverdue } from '../lib/quadrant.js';
import { dateLabel } from '../lib/date.js';
import { repeatLabel } from '../lib/repeat.js';
import { haptic, clickGuard } from '../lib/ui.js';

const props = defineProps({
  task: { type: Object, required: true },
  compact: Boolean,
  showDate: Boolean,
  swipe: { type: Boolean, default: true },
});
const emit = defineEmits(['open', 'toggle', 'delete', 'postpone']);

const q = computed(() => quadrantOf(props.task));
const pending = ref(false);
const done = computed(() => (pending.value ? !props.task.done : props.task.done));

function toggle() {
  if (pending.value) return;
  pending.value = true;
  if (!props.task.done) haptic.light();
  setTimeout(() => {
    emit('toggle');
    pending.value = false;
  }, 380);
}

// ---- 滑动 ----
// 左滑露出两个独立的圆角按钮：2 × 64 宽 + 两道 8px 间隔
const ACTIONS_W = 144;
const COMPLETE_AT = 76;
const dx = ref(0);
const animating = ref(true);
let s = null;
let passedThreshold = false;

const rubber = (v, limit) => (v <= limit ? v : limit + (v - limit) * 0.25);

function onDown(e) {
  if (!props.swipe || e.target.closest('.check')) return;
  s = { x: e.clientX, y: e.clientY, base: dx.value, dir: null, id: e.pointerId };
  passedThreshold = false;
}
function onMove(e) {
  if (!s) return;
  const mx = e.clientX - s.x;
  const my = e.clientY - s.y;
  if (!s.dir) {
    if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
    s.dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
    if (s.dir === 'h') {
      try {
        e.currentTarget.setPointerCapture(s.id);
      } catch {
        /* 指针已经抬起 */
      }
      animating.value = false;
      closeOthers();
    }
  }
  if (s.dir !== 'h') return;
  const v = s.base + mx;
  dx.value = v >= 0 ? rubber(v, 110) : -rubber(-v, ACTIONS_W);
  const over = dx.value > COMPLETE_AT;
  if (over !== passedThreshold) {
    passedThreshold = over;
    haptic.select();
  }
}
function onUp() {
  if (!s) return;
  const wasH = s.dir === 'h';
  s = null;
  animating.value = true;
  if (!wasH) return;
  clickGuard.until = Date.now() + 250;
  if (dx.value > COMPLETE_AT) {
    dx.value = 0;
    toggle();
  } else if (dx.value < -ACTIONS_W / 2.4) {
    dx.value = -ACTIONS_W;
    openRow.close = () => (dx.value = 0);
  } else dx.value = 0;
}
function closeOthers() {
  openRow.close?.();
  openRow.close = null;
}
function onClick() {
  if (Date.now() < clickGuard.until) return;
  if (dx.value !== 0) {
    dx.value = 0;
    return;
  }
  emit('open');
}
function act(name) {
  dx.value = 0;
  openRow.close = null;
  emit(name);
}
</script>

<script>
// 同一时间只允许一行处于“左滑展开”状态
const openRow = { close: null };
</script>

<template>
  <div class="trow" :class="[`q${q}`, { done, compact, pending }]" :data-task-id="task.id">
    <div v-if="swipe" class="trow-under">
      <div class="under-done" :class="{ hot: dx > COMPLETE_AT }" :style="{ opacity: dx > 0 ? 1 : 0 }">
        <Icon :name="task.done ? 'x' : 'check'" />
        <span>{{ task.done ? '未完成' : '完成' }}</span>
      </div>
      <div class="under-actions" :style="{ opacity: dx < 0 ? 1 : 0, '--p': Math.min(1, -dx / ACTIONS_W) }">
        <button class="ua postpone" @click="act('postpone')"><Icon :name="task.repeat ? 'skip' : 'arrow-right'" /><span>{{ task.repeat ? '跳过' : '推迟' }}</span></button>
        <button class="ua delete" @click="act('delete')"><Icon name="trash" /><span>删除</span></button>
      </div>
    </div>
    <div
      class="trow-main"
      :class="{ animating }"
      :style="dx > 0 ? { transform: `translateX(${dx}px)` } : dx < 0 ? { marginRight: `${-dx}px` } : undefined"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @click="onClick"
    >
      <button class="check" :aria-label="done ? '标记为未完成' : '标记为完成'" @click.stop="toggle">
        <svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.6 3.6 7.4-8" /></svg>
      </button>
      <div class="trow-body">
        <div class="trow-title"><span>{{ task.title }}</span></div>
        <div v-if="(showDate && task.date) || (compact && task.time) || task.note || task.repeat" class="trow-meta">
          <span v-if="showDate && task.date" :class="{ overdue: isOverdue(task) }">{{ dateLabel(task.date) }}</span>
          <span v-if="task.repeat" class="meta-repeat"><Icon name="repeat" /><span v-if="!compact">{{ repeatLabel(task.repeat, task.date) }}</span></span>
          <span v-if="compact && task.time" class="num">{{ task.time }}</span>
          <span v-if="task.note" class="meta-note"><Icon name="note" /></span>
        </div>
      </div>
      <div v-if="!compact && task.time" class="trow-time num">{{ task.time }}</div>
    </div>
  </div>
</template>

<style>
.trow { position: relative; border-radius: var(--r-md); }
.trow-under { position: absolute; inset: 0; }
.under-done {
  position: absolute; inset: 0; border-radius: inherit; overflow: hidden; display: flex; align-items: center; gap: 6px; padding-left: 20px;
  background: var(--fill-2); color: var(--text-2); font-size: 14px; font-weight: 600; transition: background-color .2s, color .2s;
}
.under-done.hot { background: var(--success); color: #fff; }
.under-actions { position: absolute; inset: 0 0 0 auto; display: flex; gap: 8px; }
/* 按钮随露出程度从小放大，像 iOS 那样“长”出来 */
.ua {
  width: 64px; border-radius: var(--r-md); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  color: #fff; font-size: 12px; font-weight: 600;
  transform: scale(calc(.7 + .3 * var(--p, 0))); transition: transform .2s var(--ease);
}
.ua:active { filter: brightness(.92); }
.ua .icon { width: 20px; height: 20px; }
.ua.postpone { background: var(--warn); }
.ua.delete { background: var(--danger); }

.trow-main {
  position: relative; display: flex; align-items: center; gap: 12px; min-height: 58px; padding: 10px 16px 10px 14px;
  background: var(--surface); border-radius: inherit; box-shadow: var(--shadow-1);
  touch-action: pan-y; cursor: pointer;
}
/* 右滑整体平移；左滑是卡片从右边收窄，勾选圈和标题留在原地（标题变省略号） */
.trow-main.animating { transition: transform .38s var(--ease), margin-right .38s var(--ease); }
.trow-main:active { background: color-mix(in srgb, var(--surface) 92%, var(--text)); }

/* 勾选圆圈 */
.check {
  flex: none; position: relative; width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid var(--qc); background: var(--qsoft); display: grid; place-items: center;
  transition: background-color .22s, border-color .22s, transform .22s var(--spring);
}
.check::before { content: ""; position: absolute; inset: -10px; } /* 扩大点击区域 */
.check svg { width: 16px; height: 16px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 20; stroke-dashoffset: 20; transition: stroke-dashoffset .28s var(--ease-out) .06s; }
.done .check { background: var(--qc); border-color: var(--qc); }
.done .check svg { stroke-dashoffset: 0; }
.pending .check { animation: check-pop .38s var(--spring); }
@keyframes check-pop { 40% { transform: scale(1.22); } 100% { transform: scale(1); } }
.done:not(.pending) .check { background: var(--text-3); border-color: var(--text-3); }

.trow-body { flex: 1; min-width: 0; }
.trow-title { font-size: 16px; line-height: 1.35; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color .3s; }
/* 删除线从左往右画出来 */
.trow-title span {
  background: linear-gradient(currentColor, currentColor) no-repeat 0 58% / 0 1.5px;
  transition: background-size .35s var(--ease-out);
}
.done .trow-title { color: var(--text-3); }
.done .trow-title span { background-size: 100% 1.5px; }
.trow-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; font-size: 12.5px; color: var(--text-3); }
.trow-meta .overdue { color: var(--danger); font-weight: 600; }
.meta-note .icon { width: 13px; height: 13px; display: block; }
.meta-repeat { display: inline-flex; align-items: center; gap: 3px; }
.meta-repeat .icon { width: 12px; height: 12px; }
.trow-time { flex: none; font-size: 14px; color: var(--text-2); font-weight: 500; }
.done .trow-time { color: var(--text-3); }

/* 紧凑版（四象限卡片）：没有卡片底，标题最多两行 */
.trow.compact { border-radius: 10px; }
.compact .trow-main { min-height: 0; padding: 7px 6px; gap: 8px; align-items: flex-start; background: transparent; box-shadow: none; }
.compact .trow-main:active { background: var(--fill); }
.compact .check { width: 18px; height: 18px; border-width: 1.6px; margin-top: 1px; background: transparent; }
.compact .check svg { width: 12px; height: 12px; }
.compact .trow-title { font-size: 14px; line-height: 1.4; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-all; }
.compact .trow-title span { background: none; }
.compact.done .trow-title { text-decoration: line-through; text-decoration-thickness: 1.2px; }
.compact .trow-meta { font-size: 11.5px; margin-top: 2px; gap: 6px; white-space: nowrap; overflow: hidden; }
.compact .meta-repeat .icon { width: 11px; height: 11px; }
</style>
