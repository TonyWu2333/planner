import { Solar, HolidayUtil } from 'lunar-javascript';
import { isEn } from './i18n.js';

export const pad = (n) => String(n).padStart(2, '0');
// 用本地时间格式化，不用 toISOString（那是 UTC，北京时间早上 8 点前会差一天）
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const diffDays = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5);
export const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
export const weekdayOf = (s) => WEEKDAY[parseYmd(s).getDay()];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// 星期几（0 = 周日）："周五" / "Fri"；short 只要一个字："五" / "F"
export const weekdayName = (i, short = false) => (isEn() ? (short ? WD_EN[i][0] : WD_EN[i]) : short ? WEEKDAY[i] : `周${WEEKDAY[i]}`);
// "11月20日" / "Nov 20"
export const monthDay = (d) => (isEn() ? `${MON_EN[d.getMonth()]} ${d.getDate()}` : `${d.getMonth() + 1}月${d.getDate()}日`);
// "11月" / "Nov"
export const monthName = (m0) => (isEn() ? MON_EN[m0] : `${m0 + 1}月`);
// 1 → "1st"（英文序数，用于"每月 5 号"）
export const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
// 周一为一周的第一天
export const mondayOf = (s) => addDays(s, -((parseYmd(s).getDay() + 6) % 7));

export function dateLabel(s) {
  if (!s) return '';
  const n = diffDays(s, today());
  if (isEn()) {
    const d = parseYmd(s);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    if (n > 1 && n < 7) return `${mondayOf(s) === mondayOf(today()) ? '' : 'Next '}${WD_EN[d.getDay()]}`;
    return d.getFullYear() === new Date().getFullYear() ? monthDay(d) : `${monthDay(d)}, ${d.getFullYear()}`;
  }
  if (n === 0) return '今天';
  if (n === 1) return '明天';
  if (n === 2) return '后天';
  if (n === -1) return '昨天';
  const d = parseYmd(s);
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (n > 2 && n < 7) return `${mondayOf(s) === mondayOf(today()) ? '' : '下'}周${WEEKDAY[d.getDay()]}`;
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}年${md}`;
}

// ---- 农历 / 节日 / 节气 / 法定假日 ----
const SOLAR_FEST = { 元旦节: '元旦', 妇女节: '妇女节', 劳动节: '劳动节', 青年节: '青年节', 儿童节: '儿童节', 教师节: '教师节', 国庆节: '国庆节', 平安夜: '平安夜', 圣诞节: '圣诞节', 情人节: '情人节' };
const cache = new Map();

// 返回 { text: 日历格子里那行小字, kind: 'festival' | 'term' | 'lunar', holiday: '休' | '班' | '', full: '农历九月廿二' }
export function dayInfo(s) {
  if (cache.has(s)) return cache.get(s);
  const [y, m, d] = s.split('-').map(Number);
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const lf = lunar.getFestivals()[0];
  const sf = solar.getFestivals().map((f) => SOLAR_FEST[f]).find(Boolean);
  const term = lunar.getJieQi();
  const day = lunar.getDayInChinese();
  const month = lunar.getMonthInChinese() + '月';
  let text, kind;
  if (lf) [text, kind] = [lf.replace(/节$/, '').length >= 2 ? lf.replace(/节$/, '') : lf, 'festival'];
  else if (sf) [text, kind] = [sf, 'festival'];
  else if (term) [text, kind] = [term, 'term'];
  else [text, kind] = [day === '初一' ? month : day, 'lunar'];
  const h = HolidayUtil.getHoliday(y, m, d);
  const info = {
    text,
    kind,
    holiday: h ? (h.isWork() ? '班' : '休') : '',
    holidayName: h && !h.isWork() ? h.getName() : '',
    full: `农历${month}${day}`,
  };
  cache.set(s, info);
  return info;
}

export function lunarYearLabel(year) {
  const l = Solar.fromYmd(year, 6, 1).getLunar();
  return `${l.getYearInGanZhi()}${l.getYearShengXiao()}年`;
}
