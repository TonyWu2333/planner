<script setup>
import { toastState, dismissToast } from '../lib/ui.js';

function runAction() {
  toastState.action?.();
  dismissToast();
}
</script>

<template>
  <Transition name="toast">
    <div v-if="toastState.text" :key="toastState.id" class="toast" role="status">
      <span>{{ toastState.text }}</span>
      <button v-if="toastState.action" class="toast-act" @click="runAction">{{ toastState.actionText }}</button>
    </div>
  </Transition>
</template>

<style>
.toast {
  position: fixed; left: 16px; right: 16px; bottom: calc(var(--tabbar-h) + var(--sab) + 14px); z-index: 80;
  max-width: 480px; margin: 0 auto; display: flex; align-items: center; gap: 12px;
  min-height: 48px; padding: 0 8px 0 18px; border-radius: 16px;
  background: #23252b; color: #f2f3f5; font-size: 14.5px; box-shadow: 0 12px 32px rgba(0, 0, 0, .25);
}
.toast span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 13px 0; }
.toast:not(:has(.toast-act)) { padding-right: 18px; }
.toast-act { flex: none; height: 34px; padding: 0 12px; border-radius: 10px; color: #9aa6ff; font-weight: 650; }
.toast-act:active { background: rgba(255, 255, 255, .08); }
.toast-enter-active { transition: transform .45s var(--spring), opacity .25s; }
.toast-leave-active { transition: transform .25s var(--ease), opacity .2s; }
.toast-enter-from { transform: translateY(24px) scale(.96); opacity: 0; }
.toast-leave-to { transform: translateY(12px); opacity: 0; }
</style>
