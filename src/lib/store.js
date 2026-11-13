import { reactive, watch } from 'vue';
import { load, save, loadSettings, saveSettings } from './storage.js';
import { normalizeRepeat, occursOn, instanceOf } from './repeat.js';
import { today } from './date.js';
import { taskSig, mergeState } from '../../shared/merge.js';

// 任务结构：
// { id, title, note, date: 'YYYY-MM-DD' | '', time: 'HH:MM' | '',
//   important, urgent, done, createdAt, doneAt,
//   repeat: '' | 规则字符串（如 'd1' 'w1:135' 'm1~2026-12-31'）, doneDates: [], skipDates: [],  （见 repeat.js）
//   remind: null | 提前几分钟（0 = 准时；只有设了时间才生效，见 notify.js）,
//   parentId: '' | 父任务 id }
// 子任务就是一条完整的任务（能设日期、时间、提醒、象限、备注），只是多了 parentId；只有一层，子任务不能重复。
// 父任务是重复任务、子任务又没有自己的日期时，子任务按父任务的那一天打勾（用 doneDates）。

export const state = reactive({
  ready: false,
  tasks: [],
  // 删除记录 { id: 删除时间 }：同步时告诉另一边这条删掉了（见 shared/merge.js）
  deleted: {},
  // remindOn：到点提醒总开关；defaultRemind：新任务设了时间时默认提前几分钟提醒（0 = 准时）
  // syncOn / syncCode：同步到自建服务器（见 sync.js），连接码 = 服务器地址#令牌
  settings: { showLunar: true, showHoliday: true, remindOn: true, defaultRemind: 0, syncOn: false, syncCode: '' },
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
    // 放弃：不做了但留着记录。放弃的任务同时算 done（这样所有“未完成”列表、逾期、提醒都自动排除它），
    // 统计完成数时再用 dropped 区分开
    done: !!t.done || !!t.dropped,
    dropped: !!t.dropped,
    createdAt: Number(t.createdAt) || Date.now(),
    doneAt: t.doneAt ?? null,
    repeat: normalizeRepeat(t.repeat, t.date),
    doneDates: dateList(t.doneDates),
    skipDates: dateList(t.skipDates),
    // 老数据没有这个字段：有时间的默认准时提醒
    remind: Number.isInteger(t.remind) && t.remind >= 0 ? t.remind : t.remind === undefined && t.time ? 0 : null,
    parentId: t.parentId ? String(t.parentId) : '',
    // 最后修改时间：同步时按它决定哪边的版本新（保存时自动更新，见 stamp）
    updatedAt: Number(t.updatedAt) || Number(t.createdAt) || Date.now(),
  };
}
// 旧格式：子任务是父任务里的 subtasks 清单 → 拆成独立的子任务（继承父任务的象限）
function migrate(raw) {
  return raw.flatMap((t) => [
    t,
    ...(Array.isArray(t.subtasks) ? t.subtasks : [])
      .filter((x) => x && String(x.title ?? '').trim())
      .map((x, i) => ({
        id: x.id,
        title: x.title,
        done: x.done,
        doneDates: x.doneDates,
        parentId: t.id,
        important: t.important,
        urgent: t.urgent,
        createdAt: (Number(t.createdAt) || Date.now()) + i + 1,
      })),
  ]);
}
const dateList = (a) => (Array.isArray(a) ? a.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : []);

// ---- 持久化：任何改动 250ms 后整份写回 ----
// 保存前先 stamp：和上次保存时的样子比，改过的任务更新 updatedAt，消失的任务记一条删除记录。
// 这样不管是哪里改的（包括直接改对象字段），同步时都知道改了什么。
let timer;
const saved = new Map(); // id → 上次保存时的 taskSig
const listeners = [];
// 本地真的改了东西（不是同步拉下来的）时通知，同步模块用它来触发上传
export const onLocalChange = (fn) => listeners.push(fn);
function stamp() {
  const now = Date.now();
  const alive = new Set();
  let changed = false;
  for (const t of state.tasks) {
    alive.add(t.id);
    const sig = taskSig(t);
    if (saved.get(t.id) === sig) continue;
    t.updatedAt = Math.max(now, (t.updatedAt || 0) + 1);
    saved.set(t.id, sig);
    delete state.deleted[t.id]; // 撤销删除：任务又回来了
    changed = true;
  }
  for (const id of saved.keys()) {
    if (alive.has(id)) continue;
    saved.delete(id);
    state.deleted[id] = now;
    changed = true;
  }
  if (changed) listeners.forEach((fn) => fn());
}
const remember = () => {
  saved.clear();
  for (const t of state.tasks) saved.set(t.id, taskSig(t));
};
export function flush() {
  clearTimeout(timer);
  stamp();
  return save({ version: 1, tasks: state.tasks, deleted: state.deleted });
}

// 同步：本地当前数据（先 stamp 好）
export function syncPayload() {
  stamp();
  return { tasks: state.tasks, deleted: state.deleted };
}
// 同步：把服务器返回的结果和本地合并，原地更新（任务对象尽量不换，正在编辑的界面不受影响）
export function applyRemote(remote) {
  stamp(); // 请求期间本地又改了的，先记下来，合并时按时间比较
  const merged = mergeState({ tasks: state.tasks, deleted: state.deleted }, remote);
  const next = merged.tasks.map(normalizeTask);
  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  state.tasks = next.map((t) => {
    const cur = byId.get(t.id);
    if (cur && taskSig(cur) === taskSig(t) && cur.updatedAt === t.updatedAt) return cur;
    return cur ? Object.assign(cur, t) : t;
  });
  state.deleted = merged.deleted;
  remember();
  clearTimeout(timer);
  save({ version: 1, tasks: state.tasks, deleted: state.deleted });
}

export async function initStore() {
  const [data, settings] = await Promise.all([load(), loadSettings()]);
  state.tasks = migrate(data.tasks).map(normalizeTask);
  state.deleted = data.deleted && typeof data.deleted === 'object' ? data.deleted : {};
  remember();
  Object.assign(state.settings, settings);
  state.ready = true;
  if (data.tasks.some((t) => Array.isArray(t.subtasks))) flush(); // 旧格式转换后马上存一次
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
  const remind = fields.remind !== undefined ? fields.remind : fields.time ? state.settings.defaultRemind : null;
  const task = normalizeTask({ ...fields, remind, id: uid(), createdAt: Date.now() });
  if (task.repeat && !task.date) task.date = today();
  state.tasks.push(task);
  return task;
}

export function updateTask(id, patch) {
  const t = findTask(id);
  if (!t) return;
  if ('done' in patch && patch.done !== t.done) t.doneAt = patch.done ? Date.now() : null;
  if (patch.done === false) patch = { ...patch, dropped: false }; // 取消完成 = 也取消放弃，回到待办
  Object.assign(t, patch);
}

// 放弃（不做了，但不删）。返回撤销函数
export function dropTask(id) {
  const t = findTask(id);
  if (!t || t.repeat) return () => {};
  const before = { done: t.done, dropped: t.dropped, doneAt: t.doneAt };
  Object.assign(t, { done: true, dropped: true, doneAt: Date.now() });
  return () => Object.assign(t, before);
}
// 统计“完成了几项”时不算放弃的
export const countsAsDone = (t) => t.done && !t.dropped;

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

// ---- 子任务 ----
export const childrenOf = (id) => state.tasks.filter((t) => t.parentId === id).sort((a, b) => a.createdAt - b.createdAt);
// 父任务是重复任务、子任务没有自己的日期：按父任务的那一天（occ）打勾
const perOcc = (parent, child, occ) => !!(parent?.repeat && occ && !child.date);
export const subDone = (parent, child, occ) => (perOcc(parent, child, occ) ? child.doneDates.includes(occ) : child.done);
export function subProgress(parent, occ) {
  const kids = childrenOf(parent.id).filter((c) => !c.dropped); // 放弃的子任务不算进进度
  return [kids.filter((c) => subDone(parent, c, occ)).length, kids.length];
}
// fields：{ title, date, time }；象限默认跟父任务一样
export function addSubtask(parentId, fields) {
  const p = findTask(parentId);
  if (!p || !fields.title?.trim()) return null;
  return addTask({ ...fields, parentId, important: p.important, urgent: p.urgent });
}
// 返回切换后是否全部完成
export function toggleSubtask(parentId, childId, occ) {
  const p = findTask(parentId);
  const c = findTask(childId);
  if (!p || !c) return false;
  if (perOcc(p, c, occ)) {
    const i = c.doneDates.indexOf(occ);
    if (i >= 0) c.doneDates.splice(i, 1);
    else c.doneDates.push(occ);
  } else updateTask(c.id, { done: !c.done });
  const [d, n] = subProgress(p, occ);
  return d === n;
}

// 删除任务（连同它的子任务），返回一个“撤销”函数
export function removeTask(id) {
  const removed = [];
  for (let i = state.tasks.length - 1; i >= 0; i--) {
    const t = state.tasks[i];
    if (t.id === id || t.parentId === id) removed.unshift([i, ...state.tasks.splice(i, 1)]);
  }
  return () => removed.forEach(([i, t]) => state.tasks.splice(Math.min(i, state.tasks.length), 0, t));
}

export function replaceAll(tasks) {
  state.tasks = migrate(tasks).map(normalizeTask);
}
