<script setup>
// 选年月：上方切换年份，下方 12 个月
import { ref, watch } from 'vue';
import Sheet from './Sheet.vue';
import Icon from './Icon.vue';
import { lunarYearLabel, today, parseYmd, monthName } from '../lib/date.js';
import { haptic } from '../lib/ui.js';
import { isEn } from '../lib/i18n.js';

const props = defineProps({ open: Boolean, year: Number, month: Number });
const emit = defineEmits(['close', 'pick', 'today']);

const y = ref(props.year);
const dir = ref('slide-left');
watch(() => props.open, (v) => v && (y.value = props.year));

const td = parseYmd(today());
function shiftYear(n) {
  haptic.select();
  dir.value = n > 0 ? 'slide-left' : 'slide-right';
  y.value += n;
}
function pick(m) {
  haptic.select();
  emit('pick', y.value, m);
}
</script>

<template>
  <Sheet :open="open" @close="emit('close')">
    <div class="mp">
      <div class="mp-head">
        <button class="mp-arrow press" :aria-label="$t('上一年')" @click="shiftYear(-1)"><Icon name="chevron-left" /></button>
        <div class="mp-year">
          <b class="num">{{ $t('{y}年', { y }) }}</b>
          <small>{{ lunarYearLabel(y) }}</small>
        </div>
        <button class="mp-arrow press" :aria-label="$t('下一年')" @click="shiftYear(1)"><Icon name="chevron-right" /></button>
      </div>
      <div class="mp-body">
        <Transition :name="dir">
          <div :key="y" class="mp-grid">
            <button
              v-for="m in 12"
              :key="m"
              class="mp-m press"
              :class="{ sel: y === year && m - 1 === month, now: y === td.getFullYear() && m - 1 === td.getMonth() }"
              @click="pick(m - 1)"
            >
              <span v-if="isEn()">{{ monthName(m - 1) }}</span>
              <template v-else><span class="num">{{ m }}</span>月</template>
            </button>
          </div>
        </Transition>
      </div>
      <button class="mp-today press" @click="emit('today')"><Icon name="calendar" />{{ $t('回到今天') }}</button>
    </div>
  </Sheet>
</template>

<style>
.mp { padding: 2px 16px 14px; }
.mp-head { display: flex; align-items: center; justify-content: space-between; padding: 0 2px 14px; }
.mp-year { text-align: center; line-height: 1.2; }
.mp-year b { display: block; font-size: 20px; font-weight: 700; }
.mp-year small { font-size: 12px; color: var(--text-3); }
.mp-arrow { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--fill); color: var(--text-2); }
.mp-arrow .icon { width: 20px; height: 20px; stroke-width: 2.2; }
.mp-body { position: relative; overflow: hidden; height: 196px; }
.mp-grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, 1fr); gap: 8px; }
.mp-m { border-radius: 14px; background: var(--surface-2); font-size: 14px; color: var(--text-2); }
.mp-m span { font-size: 18px; font-weight: 600; color: var(--text); margin-right: 1px; }
.mp-m.now, .mp-m.now span { color: var(--accent); }
.mp-m.sel { background: var(--accent); color: var(--on-accent); }
.mp-m.sel span { color: var(--on-accent); }
.mp-today {
  display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 44px; margin-top: 12px;
  border-radius: 14px; background: var(--accent-soft); color: var(--accent); font-size: 14.5px; font-weight: 600;
}
.mp-today .icon { width: 18px; height: 18px; }
</style>
