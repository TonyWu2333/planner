<script setup>
import { computed } from 'vue';
import { ymd, today, dayInfo } from '../lib/date.js';

const props = defineProps({
  year: Number,
  month: Number, // 0-11
  selected: String,
  compact: Boolean, // 日期选择器里的小号样式
  lunar: Boolean,
  holiday: Boolean,
  weekMode: Boolean, // 周视图下不淡化相邻月份的日子
  dots: { type: Object, default: null }, // Map<date, Array<1|2|3|4|'done'>>
});
const emit = defineEmits(['select']);

const rows = computed(() => {
  const offset = (new Date(props.year, props.month, 1).getDay() + 6) % 7;
  const days = new Date(props.year, props.month + 1, 0).getDate();
  const count = Math.ceil((offset + days) / 7);
  const td = today();
  const out = [];
  for (let r = 0; r < count; r++) {
    const row = [];
    for (let c = 0; c < 7; c++) {
      const d = new Date(props.year, props.month, 1 - offset + r * 7 + c);
      const key = ymd(d);
      row.push({
        key,
        day: d.getDate(),
        out: d.getMonth() !== props.month,
        today: key === td,
        weekend: c >= 5,
        info: props.lunar || props.holiday ? dayInfo(key) : null,
      });
    }
    out.push(row);
  }
  return out;
});

defineExpose({ rows });
</script>

<template>
  <div class="mgrid" :class="{ compact, lunar, weekmode: weekMode }">
    <div v-for="(row, i) in rows" :key="i" class="mrow">
      <button
        v-for="c in row"
        :key="c.key"
        class="mcell"
        :class="{ out: c.out, today: c.today, sel: c.key === selected, weekend: c.weekend }"
        @click="emit('select', c.key)"
      >
        <span class="mbox">
          <span class="mnum num">{{ c.day }}</span>
          <span v-if="lunar && c.info" class="mlunar" :class="c.info.kind">{{ c.info.text }}</span>
          <span v-if="holiday && c.info?.holiday" class="mhol" :class="{ work: c.info.holiday === '班' }">{{ c.info.holiday }}</span>
          <span v-if="dots" class="mdots">
            <i v-for="(d, j) in dots.get(c.key) ?? []" :key="j" :class="d === 'done' ? 'done' : 'q' + d" />
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<style>
.mgrid { --row-h: 46px; }
.mgrid.lunar { --row-h: 54px; }
.mgrid.compact { --row-h: 40px; }
.mrow { display: grid; grid-template-columns: repeat(7, 1fr); height: var(--row-h); }
.mcell { position: relative; display: grid; place-items: center; }
.mbox {
  position: relative; width: 42px; height: calc(var(--row-h) - 4px); display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 14px; transition: background-color .2s, color .2s, transform .2s var(--spring);
}
.mcell:active .mbox { transform: scale(.92); }
.mnum { font-size: 17px; font-weight: 560; line-height: 1.15; }
.mlunar { font-size: 10px; line-height: 1.25; color: var(--text-3); white-space: nowrap; letter-spacing: -.2px; }
.mlunar.festival { color: var(--danger); }
.mlunar.term { color: var(--accent); }
.mhol { position: absolute; top: 2px; right: 1px; font-size: 9px; font-weight: 700; line-height: 1; color: var(--danger); }
.mhol.work { color: var(--text-3); }
.weekend .mnum { color: var(--text-2); }
.out .mbox { opacity: .28; }
.weekmode .out .mbox { opacity: 1; }
.today .mnum, .today .mlunar { color: var(--accent); }
.today .mbox { background: var(--accent-soft); }
.sel .mbox { background: var(--accent); box-shadow: 0 4px 10px -4px color-mix(in srgb, var(--accent) 70%, transparent); }
.sel .mnum, .sel .mlunar, .sel .mlunar.festival, .sel .mlunar.term, .sel .mhol, .sel .mhol.work { color: var(--on-accent); }
.mdots { display: flex; gap: 2.5px; height: 4px; margin-top: 3px; }
.mdots i { width: 4px; height: 4px; border-radius: 50%; background: var(--qc); }
.mdots i.done { background: var(--text-3); opacity: .6; }
.sel .mdots i { background: var(--on-accent); opacity: .85; }

.compact .mbox { width: 36px; height: 36px; border-radius: 50%; }
.compact .mnum { font-size: 15px; font-weight: 500; }
</style>
