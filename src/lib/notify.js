// 到点提醒：把接下来 30 天内要提醒的任务排成系统通知（安卓 AlarmManager，App 关着也会响）。
// 做法很简单：任务一有变化，就取消全部待发通知、按最新数据重新排一遍。
import { reactive, watch } from 'vue';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { state } from './store.js';
import { occursOn, repeatLabel } from './repeat.js';
import { ymd, addDays } from './date.js';
import { QUADRANTS, quadrantOf } from './quadrant.js';

export const REMIND_OPTIONS = [0, 5, 15, 30, 60];
export function remindLabel(m) {
  if (m == null) return '不提醒';
  if (m === 0) return '准时';
  return m >= 60 ? `提前 ${m / 60} 小时` : `提前 ${m} 分钟`;
}

// 选项按钮上的短文字
export const remindShort = (m) => (m === 0 ? '准时' : m >= 60 ? `${m / 60} 小时前` : `${m} 分钟前`);

const WINDOW_DAYS = 30; // 重复任务只往后排 30 天；每次打开 App 都会续上
const MAX = 60; // 安卓对单个 App 的闹钟数量有限制，留足余量

// 纯函数：算出接下来要发的提醒（按时间排序）
export function planReminders(tasks, now = new Date()) {
  const from = ymd(now);
  const out = [];
  for (const t of tasks) {
    if (t.remind == null || !t.time || !t.date) continue;
    let dates;
    if (t.repeat) {
      dates = [];
      for (let i = 0; i <= WINDOW_DAYS; i++) {
        const d = addDays(from, i);
        if (occursOn(t, d) && !t.doneDates.includes(d)) dates.push(d);
      }
    } else dates = t.done ? [] : [t.date];
    for (const d of dates) {
      const at = new Date(`${d}T${t.time}:00`).getTime() - t.remind * 60000;
      if (at > now.getTime()) out.push({ at, task: t, date: d });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX);
}

// 通知 id 必须是 32 位整数：用 任务id+日期 算一个稳定的哈希
function idOf(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function toNotification({ at, task: t, date }) {
  const when = t.remind ? `${remindLabel(t.remind).replace('提前 ', '')}后开始 · ${t.time}` : t.time;
  const extra = [t.repeat && repeatLabel(t.repeat, t.date), QUADRANTS[quadrantOf(t)].name].filter(Boolean).join(' · ');
  return {
    id: idOf(`${t.id}|${date}`),
    title: t.title,
    body: `${when} · ${extra}`,
    schedule: { at: new Date(at), allowWhileIdle: true },
    channelId: 'reminders',
    extra: { id: t.id, occ: t.repeat ? date : '' },
  };
}

// 'granted' | 'denied' | 'prompt' | 'web'
export const notifyState = reactive({ permission: 'web', scheduled: 0 });
const native = Capacitor.isNativePlatform();

async function ensurePermission() {
  let { display } = await LocalNotifications.checkPermissions();
  if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await LocalNotifications.requestPermissions());
  notifyState.permission = display;
  return display === 'granted';
}

let syncing = Promise.resolve();
async function sync() {
  const plan = state.settings.remindOn ? planReminders(state.tasks) : [];
  const { notifications: pending } = await LocalNotifications.getPending();
  if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  notifyState.scheduled = 0;
  // 第一次真正需要提醒时才弹权限申请
  if (!plan.length || !(await ensurePermission())) return;
  await LocalNotifications.schedule({ notifications: plan.map(toNotification) });
  notifyState.scheduled = plan.length;
}
let timer;
export function scheduleSync() {
  if (!native) return;
  clearTimeout(timer);
  timer = setTimeout(() => (syncing = syncing.then(sync).catch((e) => console.error('reminder sync failed', e))), 600);
}

// onOpen(taskId, occ)：点了通知
export async function initReminders(onOpen) {
  if (!native) return;
  await LocalNotifications.createChannel({
    id: 'reminders',
    name: '任务提醒',
    description: '到点提醒设了时间的任务',
    importance: 5,
    visibility: 1,
    vibration: true,
  });
  notifyState.permission = (await LocalNotifications.checkPermissions()).display;
  LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const { id, occ } = a.notification.extra ?? {};
    if (id) onOpen(id, occ);
  });
  watch(() => [state.tasks, state.settings.remindOn], scheduleSync, { deep: true });
  scheduleSync();
}
