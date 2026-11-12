// 重复任务：一条任务 + 一条规则，日历上按天“展开”成多个实例。
//   repeat: '' | 'daily' | 'weekdays' | 'weekly' | 'monthly'
//   date 是第一次发生的日期；每周按 date 的星期几，每月按 date 的几号
//   doneDates: 哪几天已完成；skipDates: 哪几天跳过
import { parseYmd, addDays, WEEKDAY } from './date.js';

export const REPEATS = ['daily', 'weekdays', 'weekly', 'monthly'];

export function occursOn(t, d) {
  if (!t.repeat || !t.date || d < t.date || t.skipDates.includes(d)) return false;
  const day = parseYmd(d);
  switch (t.repeat) {
    case 'daily':
      return true;
    case 'weekdays':
      return day.getDay() >= 1 && day.getDay() <= 5;
    case 'weekly':
      return day.getDay() === parseYmd(t.date).getDay();
    case 'monthly':
      return day.getDate() === parseYmd(t.date).getDate();
  }
  return false;
}

// from 当天或之后第一次发生的日期（找不到返回 ''）
export function nextOccurrence(t, from) {
  let d = from < t.date ? t.date : from;
  for (let i = 0; i < 400; i++, d = addDays(d, 1)) if (occursOn(t, d)) return d;
  return '';
}

// 某一天的实例：一个只读副本，带上 occ（发生日期）和这一天的完成状态
export const instanceOf = (t, d) => ({ ...t, date: d, done: t.doneDates.includes(d), occ: d });

export function repeatLabel(repeat, date) {
  const d = date ? parseYmd(date) : new Date();
  return {
    daily: '每天',
    weekdays: '工作日',
    weekly: `每周${WEEKDAY[d.getDay()]}`,
    monthly: `每月${d.getDate()}日`,
  }[repeat] ?? '';
}

// 连续完成了几次：从 d0（今天）往前数发生的日子，碰到没完成的就停。
// 今天还没做不算断（今天还有机会）；跳过的日子不算断也不计数。
export function streakOf(t, d0) {
  let d = d0;
  if (occursOn(t, d) && !t.doneDates.includes(d)) d = addDays(d, -1);
  let n = 0;
  for (let i = 0; i < 800 && d >= t.date; i++, d = addDays(d, -1)) {
    if (!occursOn(t, d)) continue;
    if (!t.doneDates.includes(d)) break;
    n++;
  }
  return n;
}
