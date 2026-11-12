import { reactive, watchEffect } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// ---- 触感反馈（只在手机上生效） ----
const native = Capacitor.isNativePlatform();
export const haptic = {
  light: () => native && Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}),
  medium: () => native && Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}),
  select: () => native && Haptics.selectionChanged().catch(() => {}),
  success: () => native && Haptics.notification({ type: NotificationType.Success }).catch(() => {}),
};

// 滑动、拖拽结束后的那一下 click 要吞掉，不然会误开详情
export const clickGuard = { until: 0 };

// ---- 底部提示条，可带“撤销”之类的按钮 ----
export const toastState = reactive({ id: 0, text: '', action: null, actionText: '' });
let timer;
export function toast(text, { action = null, actionText = '撤销', duration = action ? 4000 : 2000 } = {}) {
  Object.assign(toastState, { id: toastState.id + 1, text, action, actionText });
  clearTimeout(timer);
  timer = setTimeout(() => (toastState.text = ''), duration);
}
export function dismissToast() {
  toastState.text = '';
}

// ---- 安卓返回键：弹窗按打开顺序入栈，返回键先关最上面的 ----
const backStack = [];
export const pushBack = (fn) => {
  backStack.push(fn);
  return () => {
    const i = backStack.lastIndexOf(fn);
    if (i >= 0) backStack.splice(i, 1);
  };
};
export function handleBack() {
  const fn = backStack.at(-1);
  if (!fn) return false;
  fn();
  return true;
}

// ---- 键盘高度 ----
// height：键盘此刻露出的高度（手势条以上的部分）。手机上由 MainActivity 在键盘动画的每一帧推过来（window.__ime），
//         弹窗逐帧跟着走，和键盘同步；浏览器里用 visualViewport 估算。
// lift：弹窗还需要自己往上抬多少。index.html 里 interactive-widget=overlays-content 让键盘直接盖在页面上，
//       页面本来不该缩小或平移；万一缩了 / 平移了（老 WebView 不认这个设置），那部分已经让出来了，不能再抬，
//       否则会抬两遍、浮在半空。
// cover：键盘一共挡住了页面多少高度（= lift + 平移量），弹窗的最大高度要扣掉它。
// snap：键盘动画进行中、或页面尺寸突变时，弹窗不做 CSS 过渡，直接跟到位。
export const keyboard = reactive({ height: 0, lift: 0, cover: 0, snap: false });
// 上抬量和 snap 同时写到根元素上（--kb-lift、.kb-snap），弹窗用它们来定位。
// 原因：弹窗一关闭就进入离场动画，Vue 不再更新它身上的绑定，上抬量会停在键盘还在时的值，
// 弹窗从半空慢慢往下滑、比键盘慢半拍；CSS 变量照样生效，关闭时也能跟着键盘一起落下。
const root = document.documentElement;
watchEffect(
  () => {
    root.style.setProperty('--kb-lift', keyboard.lift + 'px');
    root.classList.toggle('kb-snap', keyboard.snap);
  },
  { flush: 'sync' },
);
const vv = window.visualViewport;
let baseH = window.innerHeight; // 没有键盘时的页面高度
let lastKey = '';
function unsnapSoon() {
  requestAnimationFrame(() => requestAnimationFrame(() => (keyboard.snap = false)));
}
function recalc() {
  const ih = window.innerHeight;
  const pan = vv ? Math.max(0, vv.offsetTop) : 0;
  const key = ih + ',' + pan;
  if (key !== lastKey) {
    lastKey = key;
    if (!keyboard.height) baseH = Math.max(baseH, ih);
    keyboard.snap = true;
    unsnapSoon();
  }
  keyboard.cover = Math.max(0, keyboard.height - Math.max(0, baseH - ih));
  keyboard.lift = Math.max(0, keyboard.cover - pan);
}
window.addEventListener('resize', recalc);
vv?.addEventListener('scroll', recalc);
if (native) {
  window.__ime = (h, animating) => {
    keyboard.height = h;
    keyboard.snap = animating;
    recalc();
    if (!animating) unsnapSoon();
  };
} else if (vv) {
  vv.addEventListener('resize', () => {
    keyboard.height = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    recalc();
  });
}
