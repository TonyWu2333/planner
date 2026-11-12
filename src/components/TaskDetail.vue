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
import TaskRow from './TaskRow.vue';
import { parseInput } from '../lib/parse.js';
import { remindLabel } from '../lib/notify.js';
import { repeatLabel, nextOccurrence } from '../lib/repeat.js';
import {
  state, findTask, updateTask, toggleDone, removeTask,
  addSubtask, toggleSubtask, subDone, subProgress, childrenOf,
} from '../lib/store.js';
import { dateLabel, parseYmd, WEEKDAY, today, pad } from '../lib/date.js';
import { quadrantOf, quadrantFlags, isOverdue } from '../lib/quadrant.js';
import { haptic, toast, pushBack } from '../lib/ui.js';

// occ：从日历里某一天点进来的重复任务，勾选只作用于那一天
const props = defineProps({ open: Boolean, taskId: String, occ: String });
const emit = defineEmits(['close']);

// ---- 弹窗内导航：点子任务从右边推进来，左上角“‹ 父任务”滑回去（像 iOS 的导航栏） ----
const rootId = ref(props.taskId); // 底层页面；从日历直接点开子任务时，可以“返回”到它的父任务
const stack = ref([]); // 推进来的子任务 id
const navDir = ref('nav-push');
let backPops = []; // 每推一层就注册一次安卓返回键
const currentId = computed(() => stack.value[stack.value.length - 1] ?? rootId.value);

function resetNav() {
  backPops.forEach((pop) => pop());
  backPops = [];
  stack.value = [];
  rootId.value = props.taskId;
}
function pushSub(id) {
  haptic.select();
  panel.value = null;
  navDir.value = 'nav-push';
  stack.value.push(id);
  backPops.push(pushBack(goBack));
}
function goBack() {
  panel.value = null;
  navDir.value = 'nav-pop';
  if (stack.value.length) {
    stack.value.pop();
    backPops.pop()?.();
  } else if (parent.value) rootId.value = parent.value.id; // 底层就是子任务：换成它的父任务
}

// 删除后弹窗还在播关闭动画，这时继续显示最后一份数据
let last = null;
const t = computed(() => {
  const found = findTask(currentId.value);
  if (found) last = found;
  return found ?? last;
});
const panel = ref(null);
const titleEl = ref(null);
const noteEl = ref(null);

watch(() => props.open, (v) => {
  if (v) {
    resetNav();
    panel.value = null;
    nextTick(() => [titleEl.value, noteEl.value].forEach(autosize));
  } else {
    backPops.forEach((pop) => pop());
    backPops = [];
  }
});
watch(currentId, () => nextTick(() => [titleEl.value, noteEl.value].forEach(autosize)));

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
const occOf = (task) => (task?.repeat ? (task.id === props.taskId && props.occ) || nextOccurrence(task, today()) : '');
const occDay = computed(() => occOf(t.value));
// 子任务挂在重复任务下面、自己又没日期：按父任务那一天打勾
const parentOcc = computed(() => occOf(parent.value));
const isDone = computed(() => {
  if (!t.value) return false;
  if (parent.value) return subDone(parent.value, t.value, parentOcc.value);
  return t.value.repeat ? t.value.doneDates.includes(occDay.value) : t.value.done;
});

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
function setRepeat(v, done = true) {
  updateTask(t.value.id, v && !t.value.date ? { repeat: v, date: today() } : { repeat: v });
  if (done) panel.value = null; // 自定义规则还在调，面板留着
}
function setQ(n) {
  updateTask(t.value.id, quadrantFlags(n));
}
// ---- 子任务 ----
// 子任务本身就是完整的任务；这里是“父任务”视角，子任务视角下显示所属任务
const parent = computed(() => (t.value?.parentId ? findTask(t.value.parentId) : null));
const children = computed(() => (t.value && !t.value.parentId ? childrenOf(t.value.id) : []));
const newSub = ref('');
const subInput = ref(null);
const progress = computed(() => (t.value ? subProgress(t.value, occDay.value) : [0, 0]));
// 子任务在列表里的样子：重复任务的子任务按这一天显示完成状态
const subView = (c) => ({ ...c, done: subDone(t.value, c, occDay.value) });
// 和新建任务一样能识别“明天下午3点 买菜”
const subParsed = computed(() => (newSub.value.trim() ? parseInput(newSub.value) : null));
const subHint = computed(() => {
  const p = subParsed.value;
  return p?.hits.length ? [p.date && dateLabel(p.date), p.time].filter(Boolean).join(' ') : '';
});
function onAddSub() {
  const p = subParsed.value;
  if (!p) return;
  addSubtask(t.value.id, { title: p.title, date: p.date, time: p.time });
  newSub.value = ''; // 输入框保持聚焦，可以连续添加
  haptic.light();
}
function onToggleSub(c) {
  const wasDone = subDone(t.value, c, occDay.value);
  const all = toggleSubtask(t.value.id, c.id, occDay.value);
  // 最后一个子任务勾完时，顺手问一句要不要把整个任务完成
  if (!wasDone && all && !isDone.value) {
    toast('子任务都完成了', { action: () => toggleDone(t.value.id, occDay.value), actionText: '完成任务' });
  }
}
function onDeleteSub(c) {
  const undo = removeTask(c.id);
  toast(`已删除子任务「${c.title}」`, { action: undo });
}

function onCheck() {
  if (!isDone.value) haptic.light();
  if (parent.value) toggleSubtask(parent.value.id, t.value.id, parentOcc.value);
  else toggleDone(t.value.id, occDay.value);
}
function onDelete() {
  const name = t.value.title;
  const kids = children.value.length;
  const undo = removeTask(t.value.id);
  if (stack.value.length) goBack(); // 删的是推进来的子任务：退回父任务
  else emit('close');
  const extra = [t.value.repeat && '以后的重复', kids && `${kids} 个子任务`].filter(Boolean).join('和');
  toast(extra ? `已删除「${name}」及${extra}` : `已删除「${name}」`, { action: undo });
}
const fmt = (ms) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
</script>

<template>
  <Sheet :open="open" max-height="92dvh" @close="emit('close')">
    <Transition :name="navDir" mode="out-in">
    <div v-if="t" :key="currentId" class="td scroll" :class="'q' + quadrantOf(t)">
      <button v-if="parent" class="td-back press" @click="goBack">
        <Icon name="chevron-left" /><span>{{ parent.title }}</span>
      </button>
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
        <button v-if="!t.parentId" class="prop" @click="togglePanel('repeat')">
          <span class="prop-ico"><Icon name="repeat" /></span>
          <span class="prop-label">重复</span>
          <span class="prop-val" :class="{ set: t.repeat }">{{ t.repeat ? repeatLabel(t.repeat, t.date, true) : '不重复' }}</span>
          <Icon name="chevron-right" class="prop-arrow" :class="{ open: panel === 'repeat' }" />
        </button>
        <Transition name="panel">
          <div v-if="panel === 'repeat'" class="prop-panel">
            <RepeatPanel :model-value="t.repeat" :date="t.date || today()" @update:model-value="setRepeat" />
          </div>
        </Transition>
      </div>

      <template v-if="!t.parentId">
      <div class="td-label">
        子任务<template v-if="progress[1]"> · <span class="num">{{ progress[0] }}/{{ progress[1] }}</span></template>
      </div>
      <div class="st">
        <TransitionGroup tag="div" name="list" class="st-list">
          <TaskRow
            v-for="c in children"
            :key="c.id"
            :task="subView(c)"
            compact
            show-date
            hide-parent
            :postpone="false"
            @toggle="onToggleSub(c)"
            @open="pushSub(c.id)"
            @delete="onDeleteSub(c)"
          />
        </TransitionGroup>
        <label class="st-add">
          <span class="st-plus"><Icon name="plus" /></span>
          <input
            ref="subInput"
            v-model="newSub"
            placeholder="添加子任务，可以写“明天下午3点 买菜”"
            maxlength="120"
            enterkeyhint="next"
            @keydown.enter.prevent="onAddSub"
            @blur="onAddSub"
          />
          <Transition name="fade"><span v-if="subHint" class="st-hint">{{ subHint }}</span></Transition>
        </label>
      </div>
      </template>

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
    </Transition>
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
.prop-val { flex: 1; min-width: 0; text-align: right; font-size: 14.5px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
.td-label .num { color: var(--accent); }
/* 子任务：和主列表同一个 TaskRow（点开详情、左滑删除），放在灰底卡片里 */
.st { border-radius: var(--r-md); background: var(--surface-2); overflow: hidden; }
.st-list { position: relative; }
.st .trow.compact { border-radius: 0; }
.st .trow-main { background: var(--surface-2); padding: 11px 12px 11px 14px; gap: 11px; }
.st .trow-main:active { background: color-mix(in srgb, var(--surface-2) 90%, var(--text)); }
.st .trow + .trow { border-top: 1px solid var(--sep); }
.st .check { width: 20px; height: 20px; }
.st .trow-title { font-size: 15px; }
.st-add { display: flex; align-items: center; gap: 11px; min-height: 48px; padding: 0 12px 0 14px; cursor: text; }
.st-list:not(:empty) + .st-add { border-top: 1px solid var(--sep); }
.st-plus { flex: none; width: 20px; height: 20px; display: grid; place-items: center; color: var(--accent); }
.st-plus .icon { width: 19px; height: 19px; stroke-width: 2.2; }
.st-add input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 15px; padding: 12px 0; color: var(--text); }
.st-add input::placeholder { color: var(--text-3); font-size: 14px; }
.st-hint { flex: none; font-size: 12px; font-weight: 600; color: var(--accent); background: var(--accent-soft); padding: 3px 8px; border-radius: 99px; }
.td-back {
  display: inline-flex; align-items: center; gap: 2px; max-width: 80%; margin: -2px 0 6px -4px; padding: 6px 12px 6px 4px;
  border-radius: 99px; color: var(--accent); font-size: 15px; font-weight: 550;
}
.td-back:active { background: var(--accent-soft); }
.td-back span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-back .icon { flex: none; width: 22px; height: 22px; stroke-width: 2.2; }
/* 弹窗内前进 / 后退 */
.nav-push-enter-active, .nav-push-leave-active, .nav-pop-enter-active, .nav-pop-leave-active { transition: transform .2s var(--ease), opacity .2s var(--ease); }
.nav-push-enter-from { transform: translateX(28%); opacity: 0; }
.nav-push-leave-to { transform: translateX(-12%); opacity: 0; }
.nav-pop-enter-from { transform: translateX(-12%); opacity: 0; }
.nav-pop-leave-to { transform: translateX(28%); opacity: 0; }
</style>
