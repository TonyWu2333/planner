// 重复任务：一条任务 + 一条规则，日历上按天“展开”成多个实例。
//   date 是开始日期（第一次可能发生的日子）；doneDates: 哪几天已完成；skipDates: 哪几天跳过
//
// 规则存成一个短字符串（判断“有没有重复”时直接当布尔用）：
//   d<n>            每 n 天                         d1 = 每天，d3 = 每 3 天
//   w<n>:<星期>     每 n 周的这几天（0=周日…6=周六）  w1:12345 = 工作日，w1:135 = 每周一三五，w2:5 = 每两周的周五
//   m<n>            每 n 个月，按开始日期的几号；这个月没有这一天（比如 31 号）就取月底
//   y<n>            每 n 年，按开始日期的几月几号
//   后面可以带 ~YYYY-MM-DD：到这天为止
// 老数据里的 daily / weekdays / weekly / monthly 在读入时换成新写法（见 normalizeRepeat）。
import { parseYmd, addDays, diffDays, mondayOf, WEEKDAY, weekdayName, monthDay, ordinal } from './date.js';
import { isEn } from './i18n.js';

const RE = /^([dwmy])(\d{1,3})(?::([0-6]{1,7}))?(?:~(\d{4}-\d{2}-\d{2}))?$/;
const LEGACY = { daily: 'd1', weekdays: 'w1:12345', monthly: 'm1' };

const cache = new Map();
// 字符串 → { freq, n, days, until }；不认识返回 null
export function parseRule(s) {
  if (!s) return null;
  if (cache.has(s)) return cache.get(s);
  const m = RE.exec(s);
  const r = m && {
    freq: m[1],
    n: Math.max(1, Number(m[2])),
    days: m[1] === 'w' ? [...new Set((m[3] ?? '').split('').map(Number))].sort() : [],
    until: m[4] ?? '',
  };
  const ok = r && !(r.freq === 'w' && !r.days.length) ? r : null;
  cache.set(s, ok);
  return ok;
}
export function formatRule({ freq, n = 1, days = [], until = '' }) {
  let s = freq + Math.max(1, n);
  if (freq === 'w') s += ':' + [...new Set(days)].sort().join('');
  if (until) s += '~' + until;
  return s;
}
// 读入数据时用：老写法换成新写法，不认识的丢掉
export function normalizeRepeat(s, date) {
  if (!s || typeof s !== 'string') return '';
  if (LEGACY[s]) return LEGACY[s];
  if (s === 'weekly') return 'w1:' + (date ? parseYmd(date) : new Date()).getDay();
  return parseRule(s) ? s : '';
}

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

export function occursOn(t, d) {
  if (!t.repeat || !t.date || d < t.date || t.skipDates.includes(d)) return false;
  const r = parseRule(t.repeat);
  if (!r || (r.until && d > r.until)) return false;
  const day = parseYmd(d);
  const start = parseYmd(t.date);
  switch (r.freq) {
    case 'd':
      return diffDays(d, t.date) % r.n === 0;
    case 'w':
      if (!r.days.includes(day.getDay())) return false;
      return r.n === 1 || (diffDays(mondayOf(d), mondayOf(t.date)) / 7) % r.n === 0;
    case 'm': {
      const months = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
      if (months % r.n) return false;
      return day.getDate() === Math.min(start.getDate(), daysInMonth(day.getFullYear(), day.getMonth()));
    }
    case 'y':
      if (day.getMonth() !== start.getMonth() || (day.getFullYear() - start.getFullYear()) % r.n) return false;
      return day.getDate() === Math.min(start.getDate(), daysInMonth(day.getFullYear(), day.getMonth()));
  }
  return false;
}

// from 当天或之后第一次发生的日期（找不到返回 ''，比如已经过了结束日期）
export function nextOccurrence(t, from) {
  const r = parseRule(t.repeat);
  if (!r || !t.date) return '';
  // 一个周期最多多少天，往后找三个周期就够了（中间可能有跳过的）
  const span = { d: r.n, w: 7 * r.n, m: 31 * r.n, y: 366 * r.n }[r.freq];
  let d = from < t.date ? t.date : from;
  for (let i = 0; i < span * 3 + 31; i++, d = addDays(d, 1)) {
    if (r.until && d > r.until) return '';
    if (occursOn(t, d)) return d;
  }
  return '';
}

// 某一天的实例：一个只读副本，带上 occ（发生日期）和这一天的完成状态
export const instanceOf = (t, d) => ({ ...t, date: d, done: t.doneDates.includes(d), occ: d });

// 星期按周一在前排
const byMonFirst = (a, b) => ((a + 6) % 7) - ((b + 6) % 7);
const md = monthDay;

// "每周一、三、五"；withUntil 时带上“，到 12月31日”
export function repeatLabel(repeat, date, withUntil = false) {
  const r = parseRule(repeat);
  if (!r) return '';
  const start = date ? parseYmd(date) : new Date();
  let s = '';
  if (isEn()) {
    const n = r.n;
    if (r.freq === 'd') s = n === 1 ? 'Daily' : `Every ${n} days`;
    else if (r.freq === 'w') {
      const set = r.days.join('');
      if (n === 1 && set === '0123456') s = 'Daily';
      else if (n === 1 && set === '12345') s = 'Weekdays';
      else if (n === 1 && set === '06') s = 'Weekends';
      else {
        const list = [...r.days].sort(byMonFirst).map((d) => weekdayName(d)).join(', ');
        s = n === 1 ? `Every ${list}` : `Every ${n} weeks on ${list}`;
      }
    } else if (r.freq === 'm') s = `${n === 1 ? 'Monthly' : `Every ${n} months`} on the ${ordinal(start.getDate())}`;
    else s = `${n === 1 ? 'Yearly' : `Every ${n} years`} on ${md(start)}`;
    if (withUntil && r.until) s += `, until ${md(parseYmd(r.until))}`;
    return s;
  }
  switch (r.freq) {
    case 'd':
      s = r.n === 1 ? '每天' : `每${r.n}天`;
      break;
    case 'w': {
      const set = r.days.join('');
      if (r.n === 1 && set === '0123456') s = '每天';
      else if (r.n === 1 && set === '12345') s = '工作日';
      else if (r.n === 1 && set === '06') s = '每周末';
      else {
        const list = [...r.days].sort(byMonFirst).map((d) => WEEKDAY[d]).join('、');
        s = r.n === 1 ? `每周${list}` : `每${r.n}周的周${list}`;
      }
      break;
    }
    case 'm':
      s = `${r.n === 1 ? '每月' : `每${r.n}个月的`}${start.getDate()}日`;
      break;
    case 'y':
      s = `${r.n === 1 ? '每年' : `每${r.n}年的`}${md(start)}`;
      break;
  }
  if (withUntil && r.until) s += `，到${md(parseYmd(r.until))}`;
  return s;
}

// 「打卡」页分组用
export function repeatGroup(repeat) {
  const r = parseRule(repeat);
  if (!r) return '';
  if (r.freq === 'd') return r.n === 1 ? 'daily' : 'interval';
  if (r.freq === 'w') return r.n === 1 && r.days.length === 7 ? 'daily' : 'weekly';
  return r.freq === 'm' ? 'monthly' : 'yearly';
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
