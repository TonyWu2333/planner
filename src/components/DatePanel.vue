<script setup>
import { ref, computed } from 'vue';
import Icon from './Icon.vue';
import MonthGrid from './MonthGrid.vue';
import { today, addDays, mondayOf, parseYmd } from '../lib/date.js';
import { haptic } from '../lib/ui.js';

// options：顶上一排快捷按钮，默认 今天 / 明天 / 下周一 / 无日期
const props = defineProps({ modelValue: String, options: Array });
const emit = defineEmits(['update:modelValue']);

const base = parseYmd(props.modelValue || today());
const year = ref(base.getFullYear());
const month = ref(base.getMonth());

const quick = computed(() => props.options ?? [
  { label: '今天', icon: 'sun', value: today() },
  { label: '明天', icon: 'sunrise', value: addDays(today(), 1) },
  { label: '下周一', icon: 'week', value: addDays(mondayOf(today()), 7) },
  { label: '无日期', icon: 'ban', value: '' },
]);

function pick(v) {
  haptic.select();
  emit('update:modelValue', v);
  if (v) {
    const d = parseYmd(v);
    year.value = d.getFullYear();
    month.value = d.getMonth();
  }
}
function shift(n) {
  const d = new Date(year.value, month.value + n, 1);
  year.value = d.getFullYear();
  month.value = d.getMonth();
}
</script>

<template>
  <div class="dpanel">
    <div class="quick4">
      <button v-for="o in quick" :key="o.label" class="qbtn press" :class="{ on: modelValue === o.value }" @click="pick(o.value)">
        <Icon :name="o.icon" /><span>{{ o.label }}</span>
      </button>
    </div>
    <div class="dp-head">
      <b class="num">{{ year }}年{{ month + 1 }}月</b>
      <button class="icon-btn" aria-label="上个月" @click="shift(-1)"><Icon name="chevron-left" /></button>
      <button class="icon-btn" aria-label="下个月" @click="shift(1)"><Icon name="chevron-right" /></button>
    </div>
    <div class="dp-week"><span v-for="w in '一二三四五六日'" :key="w">{{ w }}</span></div>
    <MonthGrid :year="year" :month="month" :selected="modelValue" compact @select="pick" />
  </div>
</template>

<style>
.dpanel { padding: 4px 0 6px; }
.quick4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.qbtn {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0 8px; border-radius: var(--r-md);
  background: var(--surface-2); color: var(--text-2); font-size: 12.5px;
}
.qbtn .icon { width: 21px; height: 21px; }
.qbtn.on { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.dp-head { display: flex; align-items: center; padding: 12px 0 2px 6px; }
.dp-head b { flex: 1; font-size: 15px; font-weight: 600; }
.dp-head .icon-btn { width: 34px; height: 34px; }
.dp-week { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 11.5px; color: var(--text-3); padding: 2px 0 4px; }
</style>
