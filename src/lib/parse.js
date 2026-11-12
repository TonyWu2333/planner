// 从输入里识别中文日期 / 时间：
//   "明天下午3点开会" → { title: '开会', date: 明天, time: '15:00' }
//   "周五 交周报" / "下周一 9:30 例会" / "11月20日 体检" / "今晚8点半 跑步"
//   重复："每天 背单词" / "每周五晚上8点 羽毛球" / "工作日 9点 站会" / "每月15号 还信用卡"
//         "每周一三五 健身" / "隔周五 周会" / "每3天 浇花" / "每年5月20日 纪念日" / "每天 背单词 到12月31日"
import { today, addDays, parseYmd, ymd, mondayOf, pad } from './date.js';

const CN = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function cnNum(s) {
  if (/^\d+$/.test(s)) return Number(s);
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (CN[s[1]] ?? 0);
  if (s.includes('十')) return CN[s[0]] * 10 + (CN[s[2]] ?? 0);
  return CN[s] ?? NaN;
}
const NUM = '(\\d{1,2}|[一二两三四五六七八九十]{1,3})';
const WD = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 };

const DATE_RULES = [
  [/大后天/, () => addDays(today(), 3)],
  [/后天/, () => addDays(today(), 2)],
  [/明天|明日|明早|明晚/, () => addDays(today(), 1)],
  [/今天|今日|今晚|今早/, () => today()],
  [/(下下|下)?(?:周|星期|礼拜)([一二三四五六日天1-7])/, (m) => {
    const monday = mondayOf(today());
    const target = addDays(monday, WD[m[2]] - 1);
    if (m[1] === '下') return addDays(target, 7);
    if (m[1] === '下下') return addDays(target, 14);
    return target < today() ? addDays(target, 7) : target; // "周一"指接下来的那个周一
  }],
  [new RegExp(`${NUM}月${NUM}[日号]?`), (m) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), cnNum(m[1]) - 1, cnNum(m[2]));
    if (ymd(d) < today()) d.setFullYear(d.getFullYear() + 1);
    return ymd(d);
  }],
  [new RegExp(`(?<![\\d月])${NUM}[号]`), (m) => {
    const t = parseYmd(today());
    const d = new Date(t.getFullYear(), t.getMonth(), cnNum(m[1]));
    if (ymd(d) < today()) d.setMonth(d.getMonth() + 1);
    return ymd(d);
  }],
];

// 下一个“星期 w”（1-7，含今天）
const nextWeekday = (w) => {
  const target = addDays(mondayOf(today()), w - 1);
  return target < today() ? addDays(target, 7) : target;
};
// 下一个“M月D日”（含今天）
function nextMonthDay(m, d) {
  const t = new Date();
  const x = new Date(t.getFullYear(), m - 1, d);
  if (x.getMonth() !== m - 1) return '';
  if (ymd(x) < today()) x.setFullYear(x.getFullYear() + 1);
  return ymd(x);
}
// "每" "每2" "每两" "每隔一" "隔" → 间隔几（“每隔一天”是隔一天做一次，也就是每 2 天）
function every(m, prefix) {
  if (prefix === '隔') return 2;
  const n = m ? cnNum(m) : 1;
  if (!(n >= 1 && n <= 99)) return NaN;
  return prefix?.includes('隔') ? n + 1 : n;
}
const WDS = '[一二三四五六日天1-7]';
const REPEAT_RULES = [
  [new RegExp(`(每隔|每)${NUM}个?天`), (m) => {
    const n = every(m[2], m[1]);
    return n ? [`d${n}`, today()] : null;
  }],
  [/隔天/, () => ['d2', today()]],
  [/每天|每日|天天/, () => ['d1', today()]],
  [/(?:每个?)?工作日/, () => ['w1:12345', today()]],
  [/每个?周末/, () => ['w1:06', [nextWeekday(6), nextWeekday(7)].sort()[0]]],
  // 每周一三五 / 每周一、周三 / 每两周五 / 隔周周五 / 每隔一周的周二
  [new RegExp(`(每隔|每|隔)${NUM}?个?(?:周|星期|礼拜)的?(?:周|星期|礼拜)?(${WDS}(?:[、,，和及与]?(?:周|星期|礼拜)?${WDS})*)`), (m) => {
    const n = every(m[2], m[1]);
    const ws = [...new Set(m[3].match(new RegExp(WDS, 'g')).map((c) => WD[c]))];
    if (!n) return null;
    return [`w${n}:${ws.map((w) => w % 7).join('')}`, ws.map(nextWeekday).sort()[0]];
  }],
  [new RegExp(`(每隔|每|隔)${NUM}?个?(?:周|星期|礼拜)`), (m) => {
    const n = every(m[2], m[1]);
    return n ? [`w${n}:${parseYmd(today()).getDay()}`, today()] : null;
  }],
  [new RegExp(`(每隔|每)${NUM}?个?月的?${NUM}[日号]`), (m) => {
    const n = every(m[2], m[1]);
    const day = cnNum(m[3]);
    if (!n || !(day >= 1 && day <= 31)) return null;
    const t = parseYmd(today());
    const d = new Date(t.getFullYear(), t.getMonth(), day);
    if (ymd(d) < today() || d.getDate() !== day) d.setMonth(d.getMonth() + 1, day);
    return [`m${n}`, ymd(d)];
  }],
  [new RegExp(`(每隔|每)${NUM}?年的?${NUM}月${NUM}[日号]`), (m) => {
    const n = every(m[2], m[1]);
    const d = nextMonthDay(cnNum(m[3]), cnNum(m[4]));
    return n && d ? [`y${n}`, d] : null;
  }],
  [/每个?月/, () => ['m1', today()]],
  [/每年/, () => ['y1', today()]],
];
// 重复的结束日期："到12月31日" "直到下个月3号为止" 只认带月日的写法
const UNTIL_RE = new RegExp(`(?:直到|截止到?|到|至)${NUM}月${NUM}[日号]?(?:为止|结束)?`);

const PERIOD = '(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|明晚|今早|明早|晚|早)?';
const TIME_RULES = [
  // 9:30 / 21：00
  [new RegExp(`${PERIOD}\\s*(\\d{1,2})[:：](\\d{2})`), (m) => [m[1], Number(m[2]), Number(m[3])]],
  // 3点 / 下午三点半 / 8点15 / 十点一刻
  [new RegExp(`${PERIOD}\\s*${NUM}[点时](半|一刻|三刻|(\\d{1,2})分?)?`), (m) => {
    const min = m[3] === '半' ? 30 : m[3] === '一刻' ? 15 : m[3] === '三刻' ? 45 : m[4] ? Number(m[4]) : 0;
    return [m[1], cnNum(m[2]), min];
  }],
];

function toTime(period, h, min) {
  if (Number.isNaN(h) || h > 24 || min > 59) return null;
  if (/下午|傍晚|晚/.test(period ?? '') && h < 12) h += 12;
  else if (period === '中午' && h < 11) h += 12;
  else if (!period && h >= 1 && h <= 6) h += 12; // "3点开会" 默认下午
  if (h === 24) h = 0;
  return `${pad(h)}:${pad(min)}`;
}

export function parseInput(text) {
  let rest = text;
  let date = '';
  let time = '';
  let repeat = '';
  const hits = [];

  for (const [re, fn] of REPEAT_RULES) {
    const m = rest.match(re);
    const r = m && fn(m);
    if (r) {
      [repeat, date] = r;
      hits.push(m[0]);
      rest = rest.replace(m[0], ' ');
      const u = rest.match(UNTIL_RE);
      const until = u && nextMonthDay(cnNum(u[1]), cnNum(u[2]));
      if (until && until >= date) {
        repeat += '~' + until;
        hits.push(u[0]);
        rest = rest.replace(u[0], ' ');
      }
      break;
    }
  }
  for (const [re, fn] of repeat ? [] : DATE_RULES) {
    const m = rest.match(re);
    if (m) {
      date = fn(m);
      hits.push(m[0]);
      // "今晚""明早"这类词同时带了时段，留给时间规则再用
      if (!/[晚早]$/.test(m[0]) || /周|星期|礼拜/.test(m[0])) rest = rest.replace(m[0], ' ');
      break;
    }
  }
  for (const [re, fn] of TIME_RULES) {
    const m = rest.match(re);
    if (!m) continue;
    const t = toTime(...fn(m));
    if (t) {
      time = t;
      hits.push(m[0].trim());
      rest = rest.replace(m[0], ' ');
      break;
    }
  }
  // 时段词单独出现（"今晚"）但没有具体几点时，把它从标题里去掉
  rest = rest.replace(/^\s*(今晚|明晚|今早|明早)\s*/, ' ');
  if (time && !date) date = today();

  const title = rest.replace(/\s+/g, ' ').trim() || text.trim();
  return { title, date, time, repeat, hits };
}

// 小测试：node -e "import('./src/lib/parse.js').then(m=>m.selfTest())"
export function selfTest() {
  for (const s of ['明天下午3点开会', '周五 交周报', '下周一 9:30 例会', '11月20日体检', '今晚8点半跑步', '3号交房租', '买牛奶', '中午12点 吃饭', '后天上午十点一刻 面试', '每天 背单词', '每周五晚上八点 羽毛球', '每个工作日9:30站会', '每月15号还信用卡', '每周 大扫除', '每周一三五 健身', '每周一、周三 晚上7点 游泳', '隔周五 周会', '每两周的周二 汇报', '每隔一天 跑步', '每3天 浇花', '每周末 打扫', '每年5月20日 纪念日', '每两个月的1号 理发', '每天 背单词 到12月31日', '每月 总结'])
    console.log(s.padEnd(16), JSON.stringify(parseInput(s)));
}
