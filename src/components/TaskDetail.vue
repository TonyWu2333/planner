<script setup>
// 任务详情：所有修改实时保存，没有“保存”按钮
import { ref, computed, watch, nextTick } from 'vue';
import Sheet from './Sheet.vue';
import Icon from './Icon.vue';
import DatePanel from './DatePanel.vue';
import TimePanel from './TimePanel.vue';
import QuadPanel from './QuadPanel.vue';
import RepeatPanel from './RepeatPanel.vue';
import RemindPanel from './RemindPanel.vue';
import { remindLabel } from '../lib/notify.js';
import { repeatLabel, nextOccurrence } from '../lib/repeat.js';
import { state, findTask, updateTask, toggleDone, removeTask } from '../lib/store.js';
import { dateLabel, parseYmd, WEEKDAY, today, pad } from '../lib/date.js';
import { quadrantOf, quadrantFlags, isOverdue } from '../lib/quadrant.js';
import { haptic, toast } from '../lib/ui.js';

// occ：从日历里某一天点进来的重复任务，勾选只作用于那一天
const props = defineProps({ open: Boolean, taskId: String, occ: String });
const emit = defineEmits(['close']);

// 删除后弹窗还在播关闭动画，这时继续显示最后一份数据
let last = null;
const t = computed(() => {
  const found = findTask(props.taskId);
  if (found) last = found;
  return found ?? last;
});
const panel = ref(null);
const titleEl = ref(null);
const noteEl = ref(null);

watch(() => props.open, (v) => {
  if (v) {
    panel.value = null;
    nextTick(() => [titleEl.value, noteEl.value].forEach(autosize));
  }
});

function autosize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

const title = computed({
  get: () => t.value?.title ?? '',
  set: (v) => updateTask(t.value.id, { title: v.replace(/\n/g, '') }),
});
let titleBefore = '';
function onTitleBlur() {
  if (!t.value.title.trim()) updateTask(t.value.id, { title: titleBefore || '未命名任务' });
}

const dateText = computed(() => {
  const d = t.value?.date;
  if (!d) return '无日期';
  const rel = dateLabel(d);
  const p = parseYmd(d);
  const md = `${p.getMonth() + 1}月${p.getDate()}日`;
  return rel === md ? `${md} 周${WEEKDAY[p.getDay()]}` : `${rel} · ${md} 周${WEEKDAY[p.getDay()]}`;
});

// 重复任务：勾选的是哪一天（点进来的那天，否则是今天或下一次）
const occDay = computed(() => (t.value?.repeat ? props.occ || nextOccurrence(t.value, today()) : ''));
const isDone = computed(() => (t.value?.repeat ? t.value.doneDates.includes(occDay.value) : t.value?.done));

function togglePanel(p) {
  haptic.select();
  panel.value = panel.value === p ? null : p;
}
function setDate(v) {
  updateTask(t.value.id, v ? { date: v } : { date: '', time: '', repeat: '' });
  panel.value = null;
}
function setTime(v) {
  const patch = { time: v };
  if (v && !t.value.date) patch.date = today();
  // 第一次设时间：按“我的”里的默认提醒来
  if (v && !t.value.time && t.value.remind == null) patch.remind = state.settings.defaultRemind;
  updateTask(t.value.id, patch);
  panel.value = null;
}
function setRemind(v) {
  updateTask(t.value.id, { remind: v });
  panel.value = null;
}
function openRemind() {
  togglePanel(t.value.time ? 'remind' : 'time'); // 没设时间就先去选时间
}
function setRepeat(v) {
  updateTask(t.value.id, v && !t.value.date ? { repeat: v, date: today() } : { repeat: v });
  panel.value = null;
}
function setQ(n) {
  updateTask(t.value.id, quadrantFlags(n));
}
function onCheck() {
  if (!isDone.value) haptic.light();
  toggleDone(t.value.id, occDay.value);
}
function onDelete() {
  const name = t.value.title;
  const undo = removeTask(t.value.id);
  emit('close');
  toast(t.value.repeat ? `已删除「${name}」及以后的重复` : `已删除「${name}」`, { action: undo });
}
const fmt = (ms) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
</script>

<template>
  <Sheet :open="open" max-height="92dvh" @close="emit('close')">
    <div v-if="t" class="td scroll" :class="'q' + quadrantOf(t)">
      <div class="td-top" :class="{ done: isDone }">
        <button class="td-check" :aria-label="isDone ? '标记为未完成' : '标记为完成'" @click="onCheck">
          <svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.6 3.6 7.4-8" /></svg>
        </button>
        <textarea
          ref="titleEl"
          v-model="title"
          class="td-title"
          rows="1"
          placeholder="任务标题"
          maxlength="200"
          enterkeyhint="done"
          @focus="titleBefore = t.title"
          @blur="onTitleBlur"
          @input="autosize($event.target)"
          @keydown.enter.prevent="$event.target.blur()"
        />
      </div>

      <div class="td-group">
        <button class="prop" @click="togglePanel('date')">
          <span class="prop-ico"><Icon name="calendar" /></span>
          <span class="prop-label">{{ t.repeat ? '开始日期' : '日期' }}</span>
          <span class="prop-val" :class="{ set: t.date, overdue: isOverdue(t) }">{{ dateText }}</span>
          <Icon name="chevron-right" class="prop-arrow" :class="{ open: panel === 'date' }" />
        </button>
        <Transition name="panel">
          <div v-if="panel === 'date'" class="prop-panel"><DatePanel :model-value="t.date" @update:model-value="setDate" /></div>
        </Transition>
        <button class="prop" @click="togglePanel('time')">
          <span class="prop-ico"><Icon name="clock" /></span>
          <span class="prop-label">时间</span>
          <span class="prop-val num" :class="{ set: t.time }">{{ t.time || '无' }}</span>
          <Icon name="chevron-right" class="prop-arrow" :class="{ open: panel === 'time' }" />
        </button>
        <Transition name="panel">
          <div v-if="panel === 'time'" class="prop-panel"><TimePanel :model-value="t.time" @update:model-value="setTime" /></div>
        </Transition>
        <button class="prop" @click="openRemind">
          <span class="prop-ico"><Icon name="bell" /></span>
          <span class="prop-label">提醒</span>
          <span class="prop-val" :class="{ set: t.time && t.remind != null }">
            {{ !t.time ? '先设时间' : !state.settings.remindOn && t.remind != null ? '已关闭全部提醒' : remindLabel(t.remind) }}
          </span>
          <Icon name="chevron-right" class="prop-arrow" :class="{ open: panel === 'remind' }" />
        </button>
        <Transition name="panel">
          <div v-if="panel === 'remind'" class="prop-panel"><RemindPanel :model-value="t.remind" @update:model-value="setRemind" /></div>
        </Transition>
        <button class="prop" @click="togglePanel('repeat')">
          <span class="prop-ico"><Icon name="repeat" /></span>
          <span class="prop-label">重复</span>
          <span class="prop-val" :class="{ set: t.repeat }">{{ t.repeat ? repeatLabel(t.repeat, t.date) : '不重复' }}</span>
          <Icon name="chevron-right" class="prop-arrow" :class="{ open: panel === 'repeat' }" />
        </button>
        <Transition name="panel">
          <div v-if="panel === 'repeat'" class="prop-panel">
            <RepeatPanel :model-value="t.repeat" :date="t.date || today()" @update:model-value="setRepeat" />
          </div>
        </Transition>
      </div>

      <div class="td-label">象限</div>
      <QuadPanel :model-value="quadrantOf(t)" @update:model-value="setQ" />

      <div class="td-label">备注</div>
      <textarea
        ref="noteEl"
        v-model="t.note"
        class="td-note"
        rows="3"
        placeholder="添加备注…"
        @input="autosize($event.target)"
      />

      <div class="td-foot">
        <span>
          创建于 {{ fmt(t.createdAt) }}
          <template v-if="t.repeat"> · 已完成 {{ t.doneDates.length }} 次</template>
          <template v-else-if="t.doneAt"> · 完成于 {{ fmt(t.doneAt) }}</template>
        </span>
        <button class="td-del press" @click="onDelete"><Icon name="trash" />删除</button>
      </div>
    </div>
  </Sheet>
</template>

<style>
.td { flex: 1 1 auto; min-height: 0; padding: 0 16px 14px; overflow-y: auto; }
.td-top { display: flex; align-items: flex-start; gap: 12px; padding: 6px 4px 14px; }
.td-check {
  flex: none; width: 26px; height: 26px; margin-top: 3px; border-radius: 50%; border: 2px solid var(--qc); background: var(--qsoft);
  display: grid; place-items: center; transition: background-color .22s, border-color .22s;
}
.td-check svg { width: 17px; height: 17px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 20; stroke-dashoffset: 20; transition: stroke-dashoffset .28s var(--ease-out); }
.td-top.done .td-check { background: var(--qc); }
.td-top.done .td-check svg { stroke-dashoffset: 0; }
.td-title { flex: 1; min-width: 0; border: 0; outline: 0; background: none; resize: none; overflow: hidden; font-size: 21px; font-weight: 650; line-height: 1.35; padding: 0; }
.td-top.done .td-title { color: var(--text-3); text-decoration: line-through; }

.td-group { border-radius: var(--r-md); background: var(--surface-2); overflow: hidden; }
.prop { display: flex; align-items: center; gap: 12px; width: 100%; height: 52px; padding: 0 12px 0 14px; text-align: left; }
.prop + .prop, .prop-panel + .prop { border-top: 1px solid var(--sep); }
.prop:active { background: var(--fill); }
.prop-ico { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--surface); color: var(--text-2); }
.prop-ico .icon { width: 18px; height: 18px; }
.prop-label { font-size: 15px; }
.prop-val { flex: 1; text-align: right; font-size: 14.5px; color: var(--text-3); }
.prop-val.set { color: var(--accent); font-weight: 550; }
.prop-val.overdue { color: var(--danger); }
.prop-arrow { width: 16px; height: 16px; color: var(--text-3); transition: transform .3s var(--ease); }
.prop-arrow.open { transform: rotate(90deg); }
.prop-panel { padding: 4px 12px 6px; }
.prop-panel .qbtn, .prop-panel .tbtn, .prop-panel .tcustom, .prop-panel .tclear { background: var(--surface); }
.prop-panel .tbtn.on { background: var(--accent); }
.prop-panel .tcustom.on, .prop-panel .tclear.on { background: var(--accent-soft); }

.td-label { font-size: 13px; font-weight: 600; color: var(--text-3); margin: 18px 4px 8px; }
.td-note { width: 100%; min-height: 84px; border: 0; outline: 0; resize: none; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface-2); font-size: 15px; line-height: 1.55; }
.td-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; font-size: 12px; color: var(--text-3); }
.td-del { display: inline-flex; align-items: center; gap: 4px; height: 34px; padding: 0 12px; border-radius: 99px; color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); font-size: 13.5px; font-weight: 600; flex: none; }
.td-del .icon { width: 16px; height: 16px; }
</style>
