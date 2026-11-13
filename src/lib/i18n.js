// 界面语言：中文 / English。
// 写法：界面文字直接写中文并包一层 $t()，比如 $t('今天')、$t('共 {n} 项', { n })；
// 英文翻译在 i18n-en.js 里，以中文原文为键（值可以是函数，用来处理单复数）。
// 语言设置 settings.lang：'auto' 跟随系统（系统是中文就用中文，否则用英文）、'zh'、'en'。
import { reactive } from 'vue';
import EN from './i18n-en.js';

export const i18n = reactive({ lang: 'zh' });

const systemLang = () => (/^zh\b/i.test(navigator.language || 'zh') ? 'zh' : 'en');

export function applyLang(pref) {
  i18n.lang = pref === 'zh' || pref === 'en' ? pref : systemLang();
  document.documentElement.lang = i18n.lang === 'en' ? 'en' : 'zh-CN';
}

export const isEn = () => i18n.lang === 'en';

const fill = (s, p) => (p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);

export function t(zh, p) {
  if (i18n.lang !== 'en') return fill(zh, p);
  const e = EN[zh];
  if (e === undefined) {
    if (import.meta.env.DEV) console.warn('[i18n] missing:', zh);
    return fill(zh, p);
  }
  return fill(typeof e === 'function' ? e(p || {}) : e, p);
}

// English plural helper for the dictionary: plural(n, 'task') → "1 task" / "3 tasks"
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// 组件脚本里用 $t（模板里也是 $t），免得和常用的任务变量 t 撞名
export { t as $t };
