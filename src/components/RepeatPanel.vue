<script setup>
import Icon from './Icon.vue';
import { REPEATS, repeatLabel } from '../lib/repeat.js';
import { haptic } from '../lib/ui.js';

// date：每周 / 每月按这一天的星期几、几号来重复
defineProps({ modelValue: String, date: String });
const emit = defineEmits(['update:modelValue']);
function pick(v) {
  haptic.select();
  emit('update:modelValue', v);
}
</script>

<template>
  <div class="rpanel">
    <div class="rgrid">
      <button v-for="r in REPEATS" :key="r" class="tbtn press" :class="{ on: modelValue === r }" @click="pick(r)">
        {{ repeatLabel(r, date) }}
      </button>
      <button class="tclear press" :class="{ on: !modelValue }" @click="pick('')"><Icon name="ban" />不重复</button>
    </div>
    <p class="rhint">“工作日”指周一到周五；每周、每月按所选日期的星期几和几号重复</p>
  </div>
</template>

<style>
.rpanel { padding: 4px 0 8px; }
.rgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.rgrid .tclear { grid-column: span 2; height: 40px; }
.rhint { margin: 8px 2px 0; font-size: 11.5px; color: var(--text-3); }
</style>
