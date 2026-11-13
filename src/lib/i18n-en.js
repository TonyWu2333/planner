// English UI strings, keyed by the Chinese source text (see src/lib/i18n.js).
// A value can be a string with {placeholders} or a function of the params (for plurals).
//
// Glossary — use these words everywhere:
//   日程 Calendar · 四象限 Matrix · 打卡 Routines · 我的 Me · 任务 task · 子任务 subtask
//   完成 done / complete · 放弃 drop (已放弃 Dropped) · 恢复 Restore · 推迟 Postpone · 跳过 Skip
//   重复 Repeat · 提醒 Reminder · 备注 Notes · 象限 quadrant · 过期 overdue · 连续 streak
//   同步 Sync · 连接码 connection code · 令牌 token · 备份 backup
import { plural } from './i18n.js';
import calendar from './i18n-en/calendar.js';
import sheets from './i18n-en/sheets.js';
import pages from './i18n-en/pages.js';

const core = {
  // tabs
  日程: 'Calendar',
  四象限: 'Matrix',
  打卡: 'Routines',
  我的: 'Me',
  可及清单: 'Reach List',
  撤销: 'Undo',

  // reminders (notify.js)
  不提醒: 'No reminder',
  准时: 'On time',
  '提前 {n} 小时': (p) => `${plural(p.n, 'hour')} before`,
  '提前 {n} 分钟': (p) => `${plural(p.n, 'minute')} before`,
  '{n} 小时前': (p) => `${p.n} hr before`,
  '{n} 分钟前': (p) => `${p.n} min before`,
  '{n} 小时后开始': (p) => `Starts in ${plural(p.n, 'hour')}`,
  '{n} 分钟后开始': (p) => `Starts in ${plural(p.n, 'minute')}`,
  任务提醒: 'Task reminders',
  到点提醒设了时间的任务: 'Reminders for tasks that have a time',

  // quadrants (quadrant.js)
  重要且紧急: 'Important & urgent',
  重要紧急: 'Critical',
  立即处理: 'Do it now',
  重要不紧急: 'Important, not urgent',
  重要: 'Important',
  计划去做: 'Plan it',
  紧急不重要: 'Urgent, not important',
  紧急: 'Urgent',
  快速处理: 'Handle quickly',
  不重要不紧急: 'Neither',
  一般: 'Normal',
  有空再做: 'When free',

  // sync.js
  令牌不对: 'Wrong token',
  '服务器返回 {code}': 'Server returned {code}',
  连不上服务器: "Can't reach the server",

  // backup.js
  可及清单备份: 'Reach List backup',
  这不是有效的备份文件: "This isn't a valid backup file",
  '用备份里的 {a} 条任务替换当前的 {b} 条？': (p) => `Replace your ${plural(p.b, 'task')} with the ${plural(p.a, 'task')} in the backup?`,
  '已恢复 {n} 条任务': (p) => `Restored ${plural(p.n, 'task')}`,
};

export default { ...core, ...calendar, ...sheets, ...pages };
