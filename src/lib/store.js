import { reactive, watch } from 'vue';
import { load, save, loadSettings, saveSettings } from './storage.js';
import { REPEATS, occursOn, instanceOf } from './repeat.js';
import { today } from './date.js';

// 任务结构：
// { id, title, note, date: 'YYYY-MM-DD' | '', time: 'HH:MM' | '',
//   important, urgent, done, createdAt, doneAt,
//   repeat: '' | 'daily' | 'weekdays' | 'weekly' | 'monthly', doneDates: [], skipDates: [] }  （见 repeat.js）

export const state = reactive({
  ready: false,
  tasks: [],
  settings: { showLunar: true, showHoliday: true },
});

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

export function normalizeTask(t) {
  return {
    id: String(t.id ?? uid()),
    title: String(t.title ?? '').trim(),
    note: String(t.note ?? ''),
    date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : '',
    time: /^\d{2}:\d{2}$/.test(t.time) ? t.time : '',
    important: !!t.important,
    urgent: !!t.urgent,
    done: !!t.done,
    createdAt: Number(t.createdAt) || Date.now(),
    doneAt: t.doneAt ?? null,
    repeat: REPEATS.includes(t.repeat) ? t.repeat : '',
    doneDates: dateList(t.doneDates),
    skipDates: dateList(t.skipDates),
  };
}
const dateList = (a) => (Array.isArray(a) ? a.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : []);

// ---- 持久化：任何改动 250ms 后整份写回 ----
let timer;
export function flush() {
  clearTimeout(timer);
  return save({ version: 1, tasks: state.tasks });
}

export async function initStore() {
  const [data, settings] = await Promise.all([load(), loadSettings()]);
  state.tasks = data.tasks.map(normalizeTask);
  Object.assign(state.settings, settings);
  state.ready = true;
  watch(() => state.tasks, () => {
    clearTimeout(timer);
    timer = setTimeout(flush, 250);
  }, { deep: true });
  watch(() => state.settings, (s) => saveSettings(s), { deep: true });
}

// 某一天要显示的任务：普通任务 + 重复任务在这天的实例
export const tasksOn = (d) =>
  state.tasks.flatMap((t) => (t.repeat ? (occursOn(t, d) ? [instanceOf(t, d)] : []) : t.date === d ? [t] : []));

// ---- 操作 ----
export const findTask = (id) => state.tasks.find((t) => t.id === id);

export function addTask(fields) {
  const task = normalizeTask({ ...fields, id: uid(), createdAt: Date.now() });
  if (task.repeat && !task.date) task.date = today();
  state.tasks.push(task);
  return task;
}

export function updateTask(id, patch) {
  const t = findTask(id);
  if (!t) return;
  if ('done' in patch && patch.done !== t.done) t.doneAt = patch.done ? Date.now() : null;
  Object.assign(t, patch);
}

// occ：重复任务的某一天，只切换那一天的完成状态
export function toggleDone(id, occ) {
  const t = findTask(id);
  if (!t) return;
  if (!t.repeat || !occ) return updateTask(id, { done: !t.done });
  const i = t.doneDates.indexOf(occ);
  if (i >= 0) t.doneDates.splice(i, 1);
  else t.doneDates.push(occ);
}

// 重复任务跳过某一天，返回撤销函数
export function skipOccurrence(id, occ) {
  const t = findTask(id);
  if (!t) return () => {};
  t.skipDates.push(occ);
  return () => {
    const i = t.skipDates.indexOf(occ);
    if (i >= 0) t.skipDates.splice(i, 1);
  };
}

// 返回一个“撤销”函数
export function removeTask(id) {
  const index = state.tasks.findIndex((t) => t.id === id);
  if (index < 0) return () => {};
  const [task] = state.tasks.splice(index, 1);
  return () => state.tasks.splice(Math.min(index, state.tasks.length), 0, task);
}

export function replaceAll(tasks) {
  state.tasks = tasks.map(normalizeTask);
}
