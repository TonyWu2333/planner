// English strings for the sheets group (see src/lib/i18n.js)
import { plural } from '../i18n.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default {
  // shared by the sheets
  日期: 'Date',
  时间: 'Time',
  重复: 'Repeat',
  不重复: 'Never',
  备注: 'Notes',
  '添加备注…': 'Add notes…',
  无日期: 'No date',

  // TaskDetail
  未命名任务: 'Untitled task',
  任务标题: 'Title',
  恢复: 'Restore',
  标记为未完成: 'Mark as not done',
  标记为完成: 'Mark as done',
  '已放弃 · {time}': 'Dropped · {time}',
  开始日期: 'Start date',
  无: 'None',
  提醒: 'Reminder',
  先设时间: 'Set a time first',
  已关闭全部提醒: 'All reminders off',
  子任务: 'Subtasks',
  '添加子任务，可以写“明天下午3点 买菜”': 'Add a subtask',
  象限: 'Quadrant',
  '创建于 {time}': 'Created {time}',
  '已完成 {n} 次': (p) => (p.n === 1 ? 'Done once' : `Done ${p.n} times`),
  '完成于 {time}': 'Completed {time}',
  放弃: 'Drop',
  删除: 'Delete',
  子任务都完成了: 'All subtasks done',
  完成任务: 'Complete task',
  '已删除子任务「{title}」': 'Deleted subtask “{title}”',
  '已放弃「{title}」': 'Dropped “{title}”',
  '已删除「{title}」': 'Deleted “{title}”',
  '已删除「{title}」及以后的重复': 'Deleted “{title}” and future repeats',
  '已删除「{title}」及{n} 个子任务': (p) => `Deleted “{title}” and ${plural(p.n, 'subtask')}`,
  '已删除「{title}」及以后的重复和{n} 个子任务': (p) => `Deleted “{title}”, future repeats and ${plural(p.n, 'subtask')}`,

  // QuickAdd (natural-language parsing only understands Chinese, so the English placeholder stays neutral)
  '准备做点什么？': 'New task',
  '已识别 {when}，标题「{title}」': 'Detected {when}, title “{title}”',
  撤销识别: 'Undo',
  添加: 'Add',
  '已添加 · {when}': 'Added · {when}',
  '已添加到{when}': 'Added to {when}',
  '已添加（无日期）': 'Added (no date)',

  // RepeatPanel
  每: 'Every',
  减少: 'Decrease',
  增加: 'Increase',
  结束: 'Ends',
  永不结束: 'Never',
  '到 {date}': 'Until {date}',
  '1个月后': '1 month',
  '3个月后': '3 months',
  今年年底: 'Year end',
  '按开始日期 {date} 的几号重复': 'Same day of the month as the start date, {date}',
  '按开始日期 {date} 的月和日重复': 'Same month and day as the start date, {date}',

  // DatePanel
  今天: 'Today',
  明天: 'Tomorrow',
  下周一: 'Next Mon',
  上个月: 'Previous month',
  下个月: 'Next month',
  '{y}年{m}月': (p) => `${MONTHS[p.m - 1]} ${p.y}`,

  // TimePanel
  自定义: 'Custom',
  不设时间: 'No time',
};
