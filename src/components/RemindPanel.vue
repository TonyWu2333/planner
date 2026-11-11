<script setup>
import Icon from './Icon.vue';
import { REMIND_OPTIONS, remindShort } from '../lib/notify.js';
import { haptic } from '../lib/ui.js';

defineProps({ modelValue: { type: Number, default: null } });
const emit = defineEmits(['update:modelValue']);
function pick(v) {
  haptic.select();
  emit('update:modelValue', v);
}
</script>

<template>
  <div class="rpanel">
    <div class="remgrid">
      <button v-for="m in REMIND_OPTIONS" :key="m" class="tbtn press" :class="{ on: modelValue === m }" @click="pick(m)">
        {{ remindShort(m) }}
      </button>
      <button class="tclear press" :class="{ on: modelValue == null }" @click="pick(null)"><Icon name="ban" />不提醒</button>
    </div>
  </div>
</template>

<style>
.remgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.remgrid .tclear { height: 40px; }
</style>
