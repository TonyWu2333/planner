// English strings for the calendar group (see src/lib/i18n.js)
import { plural } from '../i18n.js';

// "Postponed to Tomorrow" → "Postponed to tomorrow"
const lowerRel = (s) => String(s).replace(/^(Today|Tomorrow|Yesterday|Next)\b/, (w) => w.toLowerCase());

export default {
  // CalendarView — header
  选择年月: 'Choose month',
  搜索: 'Search',
  回到今天: 'Go to today',
  今: 'Today',
  上个月: 'Previous month',
  上一周: 'Previous week',
  下个月: 'Next month',
  下一周: 'Next week',
  收起为周视图: 'Collapse to week view',
  展开月视图: 'Expand to month view',

  // CalendarView — agenda
  调休上班: 'Make-up workday',
  '已过期 · {n}': 'Overdue · {n}',
  全部移到今天: 'Move all to today',
  '已完成 {n}': '{n} done',
  '已放弃 {n}': '{n} dropped',
  今天还没有安排: 'Nothing planned for today',
  这天还没有安排: 'Nothing planned for this day',
  '试试输入「明天下午3点开会」，自动识别时间': 'Add a task to start planning',
  添加任务: 'Add task',
  新建任务: 'New task',

  // CalendarView — toasts
  '已删除「{title}」': 'Deleted “{title}”',
  '已删除「{title}」及以后的重复': 'Deleted “{title}” and future repeats',
  '已删除「{title}」及{n} 个子任务': (p) => `Deleted “{title}” and ${plural(p.n, 'subtask')}`,
  '已删除「{title}」及以后的重复和{n} 个子任务': (p) => `Deleted “{title}”, future repeats and ${plural(p.n, 'subtask')}`,
  '已放弃「{title}」': 'Dropped “{title}”',
  已跳过这一次: 'Skipped this one',
  '已推迟到{date}': (p) => `Postponed to ${lowerRel(p.date)}`,
  '{n} 个任务已移到今天': (p) => `Moved ${plural(p.n, 'task')} to today`,

  // MonthPicker
  上一年: 'Previous year',
  下一年: 'Next year',
  '{y}年': '{y}',

  // TaskRow
  恢复: 'Restore',
  未完成: 'Not done',
  完成: 'Done',
  跳过: 'Skip',
  推迟: 'Postpone',
  放弃: 'Drop',
  删除: 'Delete',
  标记为未完成: 'Mark as not done',
  标记为完成: 'Mark as done',
  已放弃: 'Dropped',
  '连续 {n} 天': '{n}-day streak',
  '连续 {n} 周': '{n}-week streak',
  '连续 {n} 个月': '{n}-month streak',
  '连续 {n} 年': '{n}-year streak',
  '连续 {n} 次': '{n} in a row',

  // SearchSheet
  无日期: 'No date',
  '搜索任务、子任务、备注': 'Search tasks, subtasks, notes',
  清空: 'Clear',
  '输入关键词，搜索全部任务的标题、子任务和备注': 'Search the titles, subtasks and notes of all your tasks',
  多个词用空格分开: 'Separate multiple words with spaces',
  '没有找到包含「{q}」的任务': 'No tasks matching “{q}”',
  待办: 'To do',
  已完成: 'Done',
};
