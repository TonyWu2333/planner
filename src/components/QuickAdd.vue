<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import Sheet from './Sheet.vue';
import Icon from './Icon.vue';
import DatePanel from './DatePanel.vue';
import TimePanel from './TimePanel.vue';
import QuadPanel from './QuadPanel.vue';
import RepeatPanel from './RepeatPanel.vue';
import { repeatLabel } from '../lib/repeat.js';
import { addTask } from '../lib/store.js';
import { parseInput } from '../lib/parse.js';
import { dateLabel, today } from '../lib/date.js';
import { QUADRANTS, quadrantFlags } from '../lib/quadrant.js';
import { haptic, toast } from '../lib/ui.js';
import { $t } from '../lib/i18n.js';

const props = defineProps({ open: Boolean, defaults: { type: Object, default: () => ({}) } });
const emit = defineEmits(['close']);

const input = ref(null);
const text = ref('');
const note = ref('');
const showNote = ref(false);
const date = ref('');
const time = ref('');
const q = ref(4);
const repeat = ref('');
const manual = reactive({ date: false, time: false, repeat: false }); // 手动选过就不再被识别结果覆盖
const useParse = ref(true);
const panel = ref(null); // 'date' | 'time' | 'quad'

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    text.value = note.value = time.value = '';
    repeat.value = props.defaults.repeat ?? '';
    showNote.value = false;
    date.value = props.defaults.date ?? today();
    q.value = props.defaults.q ?? 4;
    manual.date = manual.time = manual.repeat = false;
    useParse.value = true;
    panel.value = null;
    // 打开的同时就聚焦：弹窗上滑和键盘弹出一起进行，而不是等弹窗停稳再弹键盘
    nextTick(() => input.value?.focus({ preventScroll: true }));
  },
);

const parsed = computed(() =>
  useParse.value ? parseInput(text.value) : { title: text.value.trim(), date: '', time: '', repeat: '', hits: [] },
);
const effDate = computed(() => (manual.date ? date.value : parsed.value.date || date.value));
const effTime = computed(() => (manual.time ? time.value : parsed.value.time || time.value));
const effRepeat = computed(() => (manual.repeat ? repeat.value : parsed.value.repeat || repeat.value));
const recognized = computed(() => parsed.value.hits.length > 0 && !(manual.date && manual.time && manual.repeat));
// 显示用：重复任务显示“每周五”，普通任务显示“明天”
const whenLabel = computed(() =>
  effRepeat.value ? repeatLabel(effRepeat.value, effDate.value) : effDate.value ? dateLabel(effDate.value) : '',
);
// “已识别 明天 15:00，标题「买菜」”：时间部分要加粗，所以拆成 [前, 后] 两段
const parseMsg = computed(() => {
  const s = $t('已识别 {when}，标题「{title}」', { title: parsed.value.title });
  const i = s.indexOf('{when}');
  return [s.slice(0, i), s.slice(i + 6)];
});
const canSend = computed(() => text.value.trim().length > 0);

function togglePanel(p) {
  haptic.select();
  panel.value = panel.value === p ? null : p;
  if (panel.value) input.value?.blur();
  else input.value?.focus();
}
function setDate(v) {
  date.value = v;
  manual.date = true;
  if (!v) {
    time.value = '';
    manual.time = true;
  }
  panel.value = null;
  input.value?.focus();
}
function setTime(v) {
  time.value = v;
  manual.time = true;
  if (v && !effDate.value) {
    date.value = today();
    manual.date = true;
  }
  panel.value = null;
  input.value?.focus();
}
function setRepeat(v, done = true) {
  repeat.value = v;
  manual.repeat = true;
  if (v && !effDate.value) {
    date.value = today();
    manual.date = true;
  }
  if (!done) return; // 自定义规则还在调，面板留着
  panel.value = null;
  input.value?.focus();
}
function setQ(n) {
  q.value = n;
  panel.value = null;
  input.value?.focus();
}

function submit() {
  if (!canSend.value) return;
  const r = effRepeat.value;
  addTask({ title: parsed.value.title, note: note.value, date: effDate.value, time: effTime.value, repeat: r, ...quadrantFlags(q.value) });
  haptic.success();
  toast(
    r ? $t('已添加 · {when}', { when: [whenLabel.value, effTime.value].filter(Boolean).join(' ') })
      : effDate.value ? $t('已添加到{when}', { when: whenLabel.value })
      : $t('已添加（无日期）'),
  );
  emit('close');
}
</script>

<template>
  <Sheet :open="open" @close="emit('close')">
    <div class="qa">
      <div class="qa-row">
        <span class="qa-ring" :class="'q' + q" />
        <input
          ref="input"
          v-model="text"
          class="qa-input"
          :placeholder="$t('准备做点什么？')"
          enterkeyhint="send"
          maxlength="200"
          @keydown.enter.prevent="submit"
          @focus="panel = null"
        />
      </div>

      <Transition name="collapse">
        <div v-if="recognized" class="qa-parse">
          <Icon name="sparkle" />
          <span>{{ parseMsg[0] }}<b>{{ [whenLabel, effTime].filter(Boolean).join(' ') }}</b>{{ parseMsg[1] }}</span>
          <button @click="useParse = false">{{ $t('撤销识别') }}</button>
        </div>
      </Transition>

      <Transition name="collapse">
        <input v-if="showNote" v-model="note" class="qa-note" :placeholder="$t('添加备注…')" />
      </Transition>

      <div class="qa-bar">
        <div class="qa-chips">
          <button class="chip press" :class="{ on: effDate, active: panel === 'date' }" @click="togglePanel('date')">
            <Icon name="calendar" />{{ effDate ? dateLabel(effDate) : $t('日期') }}
          </button>
          <button class="chip press" :class="{ on: effTime, active: panel === 'time' }" @click="togglePanel('time')">
            <Icon name="clock" /><span class="num">{{ effTime || $t('时间') }}</span>
          </button>
          <button class="chip press" :class="{ on: effRepeat, active: panel === 'repeat' }" @click="togglePanel('repeat')">
            <Icon name="repeat" />{{ effRepeat ? repeatLabel(effRepeat, effDate) : $t('重复') }}
          </button>
          <button class="chip qchip on press" :class="['q' + q, { active: panel === 'quad' }]" @click="togglePanel('quad')">
            <Icon name="flag" />{{ QUADRANTS[q].short }}
          </button>
          <button class="chip press icon-only" :class="{ on: showNote }" :aria-label="$t('备注')" @click="showNote = !showNote">
            <Icon name="note" />
          </button>
        </div>
        <button class="qa-send" :disabled="!canSend" :aria-label="$t('添加')" @click="submit"><Icon name="arrow-up" /></button>
      </div>

      <Transition name="panel">
        <div v-if="panel" :key="panel" class="qa-panel">
          <DatePanel v-if="panel === 'date'" :model-value="effDate" @update:model-value="setDate" />
          <TimePanel v-else-if="panel === 'time'" :model-value="effTime" @update:model-value="setTime" />
          <RepeatPanel v-else-if="panel === 'repeat'" :model-value="effRepeat" :date="effDate || today()" @update:model-value="setRepeat" />
          <QuadPanel v-else :model-value="q" @update:model-value="setQ" />
        </div>
      </Transition>
    </div>
  </Sheet>
</template>

<style>
.qa { padding: 2px 16px 12px; }
.qa-row { display: flex; align-items: center; gap: 12px; padding: 6px 4px 10px; }
.qa-ring { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--qc); background: var(--qsoft); flex: none; transition: border-color .25s, background-color .25s; }
.qa-input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 18px; padding: 6px 0; caret-color: var(--accent); }
.qa-input::placeholder, .qa-note::placeholder { color: var(--text-3); }
.qa-parse {
  display: flex; align-items: center; gap: 6px; margin: 0 0 10px; padding: 8px 12px; border-radius: 12px;
  background: var(--accent-soft); color: var(--accent); font-size: 13px;
}
.qa-parse .icon { width: 16px; height: 16px; }
.qa-parse span { flex: 1; min-width: 0; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qa-parse b { color: var(--accent); }
.qa-parse button { font-size: 12.5px; color: var(--text-3); flex: none; }
.qa-note { width: 100%; border: 0; outline: 0; margin-bottom: 10px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); font-size: 14.5px; }
.qa-bar { display: flex; align-items: center; gap: 10px; }
.qa-chips { flex: 1; min-width: 0; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
.qa-chips::-webkit-scrollbar { display: none; }
.chip.icon-only { padding: 0 9px; }
.chip.active { box-shadow: inset 0 0 0 1.5px currentColor; }
.qa-send {
  flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  background: var(--accent); color: var(--on-accent); transition: transform .25s var(--spring), opacity .2s, background-color .2s;
}
.qa-send .icon { width: 20px; height: 20px; stroke-width: 2.4; }
.qa-send:disabled { background: var(--fill-2); color: var(--text-3); }
.qa-send:not(:disabled):active { transform: scale(.88); }
.qa-panel { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--sep); }
.panel-enter-active { transition: opacity .25s var(--ease), transform .35s var(--ease); }
.panel-enter-from { opacity: 0; transform: translateY(10px); }
</style>
