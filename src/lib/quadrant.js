import { today } from './date.js';

export const QUADRANTS = {
  1: { name: '重要且紧急', short: '重要紧急', hint: '立即处理' },
  2: { name: '重要不紧急', short: '重要', hint: '计划去做' },
  3: { name: '紧急不重要', short: '紧急', hint: '快速处理' },
  4: { name: '不重要不紧急', short: '一般', hint: '有空再做' },
};
export const quadrantOf = (t) => (t.important ? (t.urgent ? 1 : 2) : t.urgent ? 3 : 4);
export const quadrantFlags = (q) => ({ important: q <= 2, urgent: q === 1 || q === 3 });
// 重复任务不算过期（每天的习惯不该越堆越多）
export const isOverdue = (t) => !t.repeat && !t.done && !!t.date && t.date < today();

// 未完成在前；有时间的按时间排，没时间的放后面
export function byTime(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.time !== b.time) return !a.time ? 1 : !b.time ? -1 : a.time.localeCompare(b.time);
  return quadrantOf(a) - quadrantOf(b) || a.createdAt - b.createdAt;
}
// 未完成在前；按日期 → 时间排，没日期的放后面
export function byDate(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.date !== b.date) return !a.date ? 1 : !b.date ? -1 : a.date.localeCompare(b.date);
  return byTime(a, b);
}
