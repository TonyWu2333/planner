import { reactive } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';

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
// height：键盘高度。手机上在键盘动画一开始（keyboardWillShow）就拿到最终高度；浏览器里用 visualViewport 估算。
// lift：弹窗还需要自己往上抬多少。WebView 有时会跟着键盘缩小（不同手机 / 不同时机表现不一样），
//       缩掉的那部分不用再抬，否则会抬两遍、浮在半空。
// snap：WebView 尺寸突变的那一帧，弹窗不要做过渡动画（否则会先错位再滑回来）。
export const keyboard = reactive({ height: 0, lift: 0, snap: false });
let baseH = window.innerHeight; // 没有键盘时的页面高度
function recalc() {
  keyboard.lift = Math.max(0, keyboard.height - Math.max(0, baseH - window.innerHeight));
}
window.addEventListener('resize', () => {
  // 取没键盘时见过的最大高度：WebView 可能在 keyboardWillShow 之前就先缩了
  if (!keyboard.height) baseH = Math.max(baseH, window.innerHeight);
  keyboard.snap = true;
  recalc();
  requestAnimationFrame(() => requestAnimationFrame(() => (keyboard.snap = false)));
});
function setHeight(h) {
  keyboard.height = h;
  recalc();
}
if (native) {
  Keyboard.addListener('keyboardWillShow', (i) => setHeight(i.keyboardHeight));
  Keyboard.addListener('keyboardWillHide', () => setHeight(0));
} else if (window.visualViewport) {
  const vv = window.visualViewport;
  vv.addEventListener('resize', () => setHeight(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))));
}
