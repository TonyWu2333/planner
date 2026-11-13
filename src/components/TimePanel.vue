<script setup>
import Icon from './Icon.vue';
import { haptic } from '../lib/ui.js';
import { $t } from '../lib/i18n.js';

defineProps({ modelValue: String });
const emit = defineEmits(['update:modelValue']);

const PRESETS = ['08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '21:00', '22:00'];
function pick(v) {
  haptic.select();
  emit('update:modelValue', v);
}
</script>

<template>
  <div class="tpanel">
    <div class="tgrid">
      <button v-for="t in PRESETS" :key="t" class="tbtn num press" :class="{ on: modelValue === t }" @click="pick(t)">{{ t }}</button>
    </div>
    <div class="trow-custom">
      <label class="tcustom" :class="{ on: modelValue && !PRESETS.includes(modelValue) }">
        <Icon name="clock" />
        <span>{{ $t('自定义') }}</span>
        <input type="time" :value="modelValue" @change="pick($event.target.value)" />
      </label>
      <button class="tclear press" :class="{ on: !modelValue }" @click="pick('')"><Icon name="ban" />{{ $t('不设时间') }}</button>
    </div>
  </div>
</template>

<style>
.tpanel { padding: 4px 0 8px; }
.tgrid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.tbtn { height: 40px; border-radius: 12px; background: var(--surface-2); color: var(--text-2); font-size: 14.5px; font-weight: 500; }
.tbtn.on { background: var(--accent); color: var(--on-accent); font-weight: 600; }
.trow-custom { display: flex; gap: 8px; margin-top: 8px; }
.tcustom, .tclear {
  flex: 1; height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 12px;
  background: var(--surface-2); color: var(--text-2); font-size: 14px;
}
.tcustom { position: relative; overflow: hidden; }
.tcustom input { position: absolute; inset: 0; opacity: 0; width: 100%; }
.tcustom .icon, .tclear .icon { width: 18px; height: 18px; }
.tcustom.on, .tclear.on { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
</style>
