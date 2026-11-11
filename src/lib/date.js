import { Solar, HolidayUtil } from 'lunar-javascript';

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
// 周一为一周的第一天
export const mondayOf = (s) => addDays(s, -((parseYmd(s).getDay() + 6) % 7));

export function dateLabel(s) {
  if (!s) return '';
  const n = diffDays(s, today());
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
