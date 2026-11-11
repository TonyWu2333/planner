<script setup>
import Icon from './Icon.vue';
import { QUADRANTS } from '../lib/quadrant.js';
import { haptic } from '../lib/ui.js';

defineProps({ modelValue: Number });
const emit = defineEmits(['update:modelValue']);
const ICON = { 1: 'fire', 2: 'star', 3: 'bolt', 4: 'coffee' };
</script>

<template>
  <div class="qpanel">
    <button
      v-for="n in [1, 2, 3, 4]"
      :key="n"
      class="qopt press"
      :class="['q' + n, { on: modelValue === n }]"
      @click="haptic.select(), emit('update:modelValue', n)"
    >
      <span class="qopt-ico"><Icon :name="ICON[n]" /></span>
      <span class="qopt-txt"><b>{{ QUADRANTS[n].name }}</b><small>{{ QUADRANTS[n].hint }}</small></span>
      <span class="qopt-tick"><Icon name="check" /></span>
    </button>
  </div>
</template>

<style>
.qpanel { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 4px 0 8px; }
.qopt {
  position: relative; display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: var(--r-md);
  background: var(--surface-2); text-align: left; outline: 2px solid transparent; outline-offset: -2px; transition: outline-color .2s, background-color .2s, transform .18s var(--ease-out);
}
.qopt.on { background: var(--qsoft); outline-color: var(--qc); }
.qopt-ico { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--qsoft); color: var(--qc); flex: none; }
.qopt-ico .icon { width: 18px; height: 18px; }
.qopt.on .qopt-ico { background: var(--qc); color: #fff; }
.qopt-txt { min-width: 0; }
.qopt-txt b { display: block; font-size: 14px; font-weight: 600; color: var(--text); }
.qopt-txt small { font-size: 11.5px; color: var(--text-3); }
.qopt-tick { position: absolute; top: 6px; right: 6px; color: var(--qc); opacity: 0; transition: opacity .2s; }
.qopt-tick .icon { width: 15px; height: 15px; stroke-width: 2.6; }
.qopt.on .qopt-tick { opacity: 1; }
</style>
