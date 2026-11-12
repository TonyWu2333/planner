<script setup>
// 重复规则：上面一排常用的一键选，下面自定义“每 N 天 / 周 / 月 / 年”、每周哪几天、到哪天为止。
import { ref, computed } from 'vue';
import Icon from './Icon.vue';
import DatePanel from './DatePanel.vue';
import { parseRule, formatRule, repeatLabel } from '../lib/repeat.js';
import { parseYmd, addDays, dateLabel, today } from '../lib/date.js';
import { haptic } from '../lib/ui.js';

// date：开始日期。每月 / 每年按它的几号、几月几号重复；“每周X”按它的星期几
const props = defineProps({ modelValue: String, date: String });
const emit = defineEmits(['update:modelValue']);

const rule = computed(() => parseRule(props.modelValue));
const dow = computed(() => parseYmd(props.date || today()).getDay());
const base = computed(() => (rule.value ? formatRule({ ...rule.value, until: '' }) : ''));

const presets = computed(() => ['d1', 'w1:12345', `w1:${dow.value}`, 'm1', 'y1']);

// 第二个参数 done：一键选的（常用项、不重复）选完就收起面板；自定义还要接着调，不收起
function emitRule(r, done = false) {
  haptic.select();
  emit('update:modelValue', r ? formatRule(r) : '', done);
}
function pickPreset(p) {
  emitRule({ ...parseRule(p), until: rule.value?.until ?? '' }, true);
}

// ---- 自定义 ----
// 还没设重复时，从“每天”开始改
const cur = computed(() => rule.value ?? { freq: 'd', n: 1, days: [], until: '' });
const FREQS = [
  ['d', '天'],
  ['w', '周'],
  ['m', '个月'],
  ['y', '年'],
];
function setFreq(f) {
  if (rule.value && f === cur.value.freq) return;
  emitRule({ ...cur.value, freq: f, days: f === 'w' ? (cur.value.days.length ? cur.value.days : [dow.value]) : [] });
}
function step(d) {
  const n = Math.min(99, Math.max(1, cur.value.n + d));
  if (rule.value && n === cur.value.n) return;
  emitRule({ ...cur.value, n });
}
// 星期按周一在前排
const WEEK = [1, 2, 3, 4, 5, 6, 0].map((d) => [d, '日一二三四五六'[d]]);
function toggleDay(d) {
  const days = cur.value.days.includes(d) ? cur.value.days.filter((x) => x !== d) : [...cur.value.days, d];
  if (!days.length) return; // 至少留一天
  emitRule({ ...cur.value, freq: 'w', days });
}

// ---- 结束日期 ----
const untilOpen = ref(false);
const endOptions = computed(() => {
  const from = props.date && props.date > today() ? props.date : today();
  return [
    { label: '永不结束', icon: 'ban', value: '' },
    { label: '1个月后', icon: 'week', value: addDays(from, 30) },
    { label: '3个月后', icon: 'week', value: addDays(from, 91) },
    { label: '今年年底', icon: 'calendar', value: `${parseYmd(from).getFullYear()}-12-31` },
  ];
});
function setUntil(v) {
  if (v && props.date && v < props.date) v = props.date; // 不能早于开始日期
  emitRule({ ...cur.value, until: v });
  untilOpen.value = false;
}

const summary = computed(() => (rule.value ? repeatLabel(props.modelValue, props.date, true) : '不重复'));
</script>

<template>
  <div class="rpanel">
    <div class="rgrid">
      <button v-for="p in presets" :key="p" class="tbtn press" :class="{ on: base === p }" @click="pickPreset(p)">
        {{ repeatLabel(p, date) }}
      </button>
      <button class="tclear press" :class="{ on: !modelValue }" @click="emitRule(null, true)"><Icon name="ban" />不重复</button>
    </div>

    <div class="rp-custom" :class="{ idle: !rule }">
      <div class="rp-row">
        <span class="rp-label">每</span>
        <div class="rp-step">
          <button class="tbtn press" aria-label="减少" :disabled="cur.n <= 1" @click="step(-1)">−</button>
          <b class="num">{{ cur.n }}</b>
          <button class="tbtn press" aria-label="增加" @click="step(1)">+</button>
        </div>
        <div class="rp-freq">
          <button v-for="[f, l] in FREQS" :key="f" class="tbtn press" :class="{ on: rule && cur.freq === f }" @click="setFreq(f)">{{ l }}</button>
        </div>
      </div>

      <div v-if="rule?.freq === 'w'" class="rp-days">
        <button v-for="[d, l] in WEEK" :key="d" class="tbtn press" :class="{ on: cur.days.includes(d) }" @click="toggleDay(d)">{{ l }}</button>
      </div>
      <p v-else-if="rule?.freq === 'm' || rule?.freq === 'y'" class="rp-note">按开始日期 {{ dateLabel(date || today()) }} 的{{ rule.freq === 'm' ? '几号' : '月和日' }}重复</p>

      <button class="rp-row rp-until press" :disabled="!rule" @click="untilOpen = !untilOpen">
        <span class="rp-label">结束</span>
        <span class="rp-until-val" :class="{ set: rule?.until }">{{ rule?.until ? `到 ${dateLabel(rule.until)}` : '永不结束' }}</span>
        <Icon name="chevron-right" class="rp-arrow" :class="{ open: untilOpen }" />
      </button>
      <DatePanel v-if="untilOpen && rule" class="rp-date" :model-value="rule.until" :options="endOptions" @update:model-value="setUntil" />
    </div>

    <p class="rhint"><Icon name="repeat" />{{ summary }}</p>
  </div>
</template>

<style>
.rpanel { padding: 4px 0 8px; }
.rgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.rgrid .tbtn { padding: 0 4px; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rgrid .tclear { height: 40px; }

.rp-custom { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--sep); display: flex; flex-direction: column; gap: 10px; transition: opacity .2s; }
.rp-custom.idle .rp-freq, .rp-custom.idle .rp-step b { opacity: .55; }
.rp-row { display: flex; align-items: center; gap: 10px; width: 100%; }
.rp-label { flex: none; width: 30px; font-size: 14px; font-weight: 600; color: var(--text-2); }
.rp-step { flex: none; display: flex; align-items: center; gap: 4px; }
.rp-step .tbtn { width: 34px; height: 34px; padding: 0; font-size: 18px; line-height: 1; }
.rp-step .tbtn:disabled { opacity: .4; }
.rp-step b { min-width: 26px; text-align: center; font-size: 17px; font-weight: 650; }
.rp-freq { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.rp-freq .tbtn { height: 34px; padding: 0; font-size: 13.5px; }
.rp-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; padding-left: 40px; }
.rp-days .tbtn { height: 34px; padding: 0; font-size: 14px; border-radius: 50%; aspect-ratio: 1; height: auto; }
.rp-note { margin: -2px 0 0 40px; font-size: 12px; color: var(--text-3); }
.rp-until { height: 36px; text-align: left; }
.rp-until:disabled { opacity: .45; }
.rp-until-val { flex: 1; font-size: 14px; color: var(--text-3); }
.rp-until-val.set { color: var(--accent); font-weight: 600; }
.rp-arrow { width: 16px; height: 16px; color: var(--text-3); transition: transform .25s var(--ease); }
.rp-arrow.open { transform: rotate(90deg); }
.rp-date { margin-top: -4px; }
.rhint { display: flex; align-items: center; gap: 5px; margin: 12px 2px 0; font-size: 12.5px; color: var(--text-2); font-weight: 500; }
.rhint .icon { width: 13px; height: 13px; color: var(--accent); flex: none; }
</style>
