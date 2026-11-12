<script setup>
// 底部弹窗：弹簧曲线进出、拖顶部把手下滑关闭、跟着键盘一起上移、接入安卓返回键
import { ref, watch, onBeforeUnmount } from 'vue';
import { pushBack, keyboard } from '../lib/ui.js';

const props = defineProps({ open: Boolean, maxHeight: { type: String, default: '90dvh' } });
const emit = defineEmits(['close', 'after-leave', 'after-enter']);

let popBack = null;
watch(
  () => props.open,
  (v) => {
    popBack?.();
    popBack = v ? pushBack(() => emit('close')) : null;
    // 关闭时马上让输入框失焦：键盘和弹窗同时开始收，而不是等弹窗动画结束、元素被移除才收键盘
    if (!v && document.activeElement?.closest?.('.sheet')) document.activeElement.blur();
  },
  { immediate: true },
);

onBeforeUnmount(() => popBack?.());

// 拖动把手下滑关闭
const dragY = ref(0);
const dragging = ref(false);
let start = null;
function down(e) {
  if (!e.target.closest('[data-drag]')) return;
  start = { y: e.clientY, t: performance.now() };
  dragging.value = true;
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    /* 指针已经抬起 */
  }
}
function move(e) {
  if (!start) return;
  const d = e.clientY - start.y;
  dragY.value = d > 0 ? d : -Math.sqrt(-d) * 2; // 往上拉有阻尼
}
function up() {
  if (!start) return;
  const v = dragY.value / (performance.now() - start.t);
  start = null;
  dragging.value = false;
  if (dragY.value > 110 || (v > 0.5 && dragY.value > 20)) emit('close');
  dragY.value = 0;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="sheet-backdrop" @click="emit('close')" />
    </Transition>
    <Transition name="sheet" @after-leave="emit('after-leave')" @after-enter="emit('after-enter')">
      <div
        v-if="open"
        class="sheet"
        :class="{ dragging }"
        :style="{
          // 键盘上抬量来自根元素的 --kb-lift（见 ui.js），拖动量放在 --drag
          '--drag': dragY ? `${dragY}px` : undefined,
          maxHeight: `calc(${maxHeight} - ${keyboard.cover}px)`,
        }"
        role="dialog"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="up"
      >
        <div class="sheet-grip" data-drag><i /></div>
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.sheet-backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(8, 10, 16, 0.42); }
.sheet {
  position: fixed; left: 0; right: 0; z-index: 51; max-width: 600px; margin: 0 auto;
  display: flex; flex-direction: column;
  background: var(--surface); border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding-bottom: var(--sab);
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.12);
  bottom: 0; will-change: transform, translate;
  /* 拖动和键盘上抬用独立的 translate 属性，进出场动画用 transform，两者叠加互不打架
     （否则弹窗刚打开、键盘同时弹起时，进场动画会盖掉逐帧的键盘位置，结束时猛跳一下）。
     --kb-lift 不含底部手势条，弹窗自己的底部留白（--sab）正好藏在键盘后面 */
  translate: 0 calc(var(--drag, 0px) - var(--kb-lift, 0px));
  /* 键盘动画中由 keyboard.snap 关掉过渡、逐帧跟随；这里只管拖动松手后的回弹等 */
  transition: translate 0.3s cubic-bezier(0.2, 0, 0, 1);
}
.sheet.dragging, .kb-snap .sheet { transition: none; }
.sheet-grip { flex: none; height: 22px; display: grid; place-items: center; touch-action: none; cursor: grab; }
.sheet-grip i { width: 38px; height: 5px; border-radius: 3px; background: var(--fill-2); }
.sheet-enter-from, .sheet-leave-to { transform: translateY(100%) !important; }
.sheet-enter-active { transition: transform 0.46s var(--ease) !important; }
.sheet-leave-active { transition: transform 0.32s var(--ease) !important; }
</style>
