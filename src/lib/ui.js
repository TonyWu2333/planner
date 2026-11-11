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
// 手机上：键盘动画一开始（keyboardWillShow）就拿到最终高度，弹窗用位移跟着一起上去；
// WebView 本身不缩放（capacitor.config 里关掉了 SystemBars 的 insets 处理），避免整页重排。
// 浏览器里：用 visualViewport 估算。
export const keyboard = reactive({ height: 0 });
if (native) {
  Keyboard.addListener('keyboardWillShow', (i) => (keyboard.height = i.keyboardHeight));
  Keyboard.addListener('keyboardWillHide', () => (keyboard.height = 0));
} else if (window.visualViewport) {
  const vv = window.visualViewport;
  vv.addEventListener('resize', () => (keyboard.height = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))));
}
