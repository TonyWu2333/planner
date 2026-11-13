// planner: command-line access to the 可及清单 app's tasks, for people and agents.
// Talks to the sync server (server/server.js); the phone app syncs with the same server.
// Built into one file (skill/planner/scripts/planner.mjs) by `npm run build:agent`. Node 18+.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseInput } from '../src/lib/parse.js';
import { occursOn, nextOccurrence, repeatLabel, normalizeRepeat, parseRule } from '../src/lib/repeat.js';
import { today, addDays, mondayOf, WEEKDAY, parseYmd } from '../src/lib/date.js';
import { QUADRANTS, quadrantOf, quadrantFlags } from '../src/lib/quadrant.js';

const HELP = `planner — read and change tasks in the 可及清单 app

Setup (once):
  planner login <code>          save the connection code printed by the sync server (url#token)
  planner status                check the connection and show counts

Read:
  planner today                 overdue + today's tasks (default command)
  planner list [range]          --date D | --from D --to D | --week | --overdue | --undated | --all
                                add --done to include finished/dropped tasks
  planner show <id>             one task with its subtasks
  planner search <words...>     search titles and notes

Write:
  planner add <text...>         Chinese natural language works: "明天下午3点 开会", "每周一三五 健身"
      --date D --time HH:MM --repeat R --quadrant 1-4 --note TEXT --parent ID --remind MIN --raw
  planner done <id> [--date D]  complete (for a repeating task: that day, default today / next)
  planner undone <id> [--date D]
  planner skip <id> [--date D]  skip one occurrence of a repeating task
  planner drop <id>             give up on a one-off task (kept as a record)
  planner restore <id>          undo drop / done
  planner edit <id> [--title T] [--date D] [--time HH:MM] [--repeat R] [--quadrant 1-4] [--note T] [--remind MIN]
  planner delete <id>           delete (with its subtasks)

Options: --json for machine-readable output.
Dates: YYYY-MM-DD or words like 今天 明天 周五 下周一 11月20日. Use "" to clear (e.g. --time "").
Repeat: 每天 工作日 每周一三五 隔周五 每3天 每月 每年 (or rule strings d1 w1:135 w2:5 m1 y1, "~YYYY-MM-DD" = until; "" = none).
Quadrants: 1 重要且紧急, 2 重要不紧急, 3 紧急不重要, 4 不重要不紧急.
IDs: any unique prefix of the id shown as #xxxxxxxx.
Config: PLANNER_CODE (url#token) env, or PLANNER_URL + PLANNER_TOKEN, or ~/.config/planner/config.json.
`;

// ---------- args ----------
const VALUE_FLAGS = new Set(['date', 'from', 'to', 'time', 'repeat', 'quadrant', 'note', 'parent', 'remind', 'title']);
function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) pos.push(a);
    else {
      const [k, inline] = a.slice(2).split(/=(.*)/s);
      if (VALUE_FLAGS.has(k)) {
        if (inline === undefined && i + 1 >= argv.length) fail(`--${k} needs a value`);
        opt[k] = inline ?? argv[++i];
      } else opt[k] = true;
    }
  }
  return { cmd: pos[0] ?? 'today', args: pos.slice(1), opt };
}

class UsageError extends Error {}
const fail = (msg) => {
  throw new UsageError(msg);
};

// ---------- config & server ----------
const CONFIG_FILE = path.join(os.homedir(), '.config', 'planner', 'config.json');
function parseCode(code) {
  const m = String(code ?? '').trim().match(/^(https?:\/\/[^\s#]+?)\/?#([A-Za-z0-9._~-]{16,})$/);
  return m ? { url: m[1], token: m[2] } : null;
}
function config() {
  if (process.env.PLANNER_URL && process.env.PLANNER_TOKEN)
    return { url: process.env.PLANNER_URL.replace(/\/$/, ''), token: process.env.PLANNER_TOKEN };
  const fromEnv = parseCode(process.env.PLANNER_CODE);
  if (fromEnv) return fromEnv;
  try {
    const c = parseCode(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).code);
    if (c) return c;
  } catch {
    /* no config file */
  }
  fail('Not connected. Run: planner login <url#token>  (the sync server prints this code when it starts)');
}

async function api(method, route, body) {
  const { url, token } = config();
  let res;
  try {
    res = await fetch(url + route, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    fail(`Cannot reach the sync server at ${url} (${e.cause?.code ?? e.message})`);
  }
  if (res.status === 401) fail('The sync server rejected the token. Run planner login again with the current code.');
  if (!res.ok) fail(`Sync server error ${res.status}: ${await res.text()}`);
  return res.json();
}

let state;
async function load() {
  state = await api('GET', '/api/state');
  // Use the phone's timezone so "today" means the user's today, even on a UTC server
  const tz = process.env.PLANNER_TZ || state.meta?.tz;
  if (tz) process.env.TZ = tz;
  return state;
}
// Send only what changed; the server merges by updatedAt
async function push(tasks, deleted = {}) {
  const now = Date.now();
  for (const t of tasks) t.updatedAt = Math.max(now, (t.updatedAt || 0) + 1);
  state = await api('POST', '/api/sync', { tasks, deleted });
}

// ---------- helpers ----------
const short = (id) => id.replace(/-/g, '').slice(0, 8);
function find(prefix) {
  if (!prefix) fail('Give a task id (see #xxxxxxxx in planner today/list)');
  const p = prefix.replace(/^#/, '').replace(/-/g, '').toLowerCase();
  const exact = state.tasks.find((t) => t.id.replace(/-/g, '').toLowerCase() === p);
  if (exact) return exact;
  if (p.length < 4) fail(`Id ${prefix} is too short; use at least 4 characters of the #id`);
  const hits = state.tasks.filter((t) => t.id.replace(/-/g, '').toLowerCase().startsWith(p));
  if (!hits.length) fail(`No task with id ${prefix}`);
  if (hits.length > 1) fail(`Id ${prefix} is ambiguous: ${hits.map((t) => '#' + short(t.id) + ' ' + t.title).join(', ')}`);
  return hits[0];
}
const children = (id) => state.tasks.filter((t) => t.parentId === id);
const parentOf = (t) => (t.parentId ? state.tasks.find((p) => p.id === t.parentId) : null);

function toDate(v) {
  if (v === '' || v == null) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const p = parseInput(`${v} x`);
  if (p.date) return p.date;
  fail(`Cannot read date "${v}" (use YYYY-MM-DD or 今天/明天/周五/11月20日)`);
}
function toTime(v) {
  if (v === '' || v == null) return '';
  const m = /^(\d{1,2})[:：](\d{2})$/.exec(v);
  if (m && +m[1] < 24 && +m[2] < 60) return `${m[1].padStart(2, '0')}:${m[2]}`;
  const p = parseInput(`${v} x`);
  if (p.time) return p.time;
  fail(`Cannot read time "${v}" (use HH:MM or 下午3点)`);
}
function toRepeat(v, date) {
  if (v === '' || v == null || v === 'none') return { repeat: '' };
  const direct = normalizeRepeat(v, date);
  if (direct) return { repeat: direct };
  const p = parseInput(`${v} x`);
  if (p.repeat) return { repeat: p.repeat, date: p.date };
  fail(`Cannot read repeat "${v}" (e.g. 每天, 工作日, 每周一三五, 每月, d1, w1:135)`);
}
function toQuadrant(v) {
  const q = Number(v);
  if (![1, 2, 3, 4].includes(q)) fail('--quadrant must be 1, 2, 3 or 4');
  return quadrantFlags(q);
}
function toRemind(v) {
  if (v === '' || v === 'none') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) fail('--remind is minutes before (0 = on time), or "" for none');
  return n;
}
const occOf = (t, opt) => {
  if (!t.repeat) return '';
  if (opt.date) return toDate(opt.date);
  return occursOn(t, today()) ? today() : nextOccurrence(t, today()) || today();
};

// One-line view of a task (or of a repeating task on day d)
function line(t, d) {
  const isRep = !!t.repeat && d;
  const done = isRep ? t.doneDates.includes(d) : t.done;
  const box = t.dropped ? '[x]' : done ? '[✓]' : '[ ]';
  const bits = [
    QUADRANTS[quadrantOf(t)].name,
    t.repeat && repeatLabel(t.repeat, t.date, true),
    !isRep && t.date && t.date !== today() && dayLabel(t.date),
    t.dropped && '已放弃',
    parentOf(t) && `↳ ${parentOf(t).title}`,
    children(t.id).length && `子任务 ${children(t.id).filter((c) => c.done).length}/${children(t.id).length}`,
  ].filter(Boolean);
  return `${box} ${t.time ? t.time + ' ' : ''}${t.title}  (${bits.join(' · ')})  #${short(t.id)}`;
}
function dayLabel(d) {
  const n = Math.round((parseYmd(d) - parseYmd(today())) / 864e5);
  const rel = { '-1': '昨天', 0: '今天', 1: '明天', 2: '后天' }[n];
  return `${d}${rel ? ' ' + rel : ''} 周${WEEKDAY[parseYmd(d).getDay()]}`;
}
const json = (t, d) => ({
  id: t.id,
  short: short(t.id),
  title: t.title,
  note: t.note,
  date: d || t.date,
  time: t.time,
  quadrant: quadrantOf(t),
  quadrantName: QUADRANTS[quadrantOf(t)].name,
  repeat: t.repeat,
  repeatLabel: t.repeat ? repeatLabel(t.repeat, t.date, true) : '',
  done: t.repeat && d ? t.doneDates.includes(d) : t.done,
  dropped: !!t.dropped,
  remind: t.remind,
  parentId: t.parentId || null,
  subtasks: children(t.id).map((c) => ({ id: c.id, short: short(c.id), title: c.title, done: c.done })),
});
const byTimeKey = (t) => `${t.time || '99'}${t.title}`;

// Tasks happening on day d: one-off on d + repeating occurrences
const onDay = (d) =>
  state.tasks.filter((t) => (t.repeat ? occursOn(t, d) : t.date === d)).sort((a, b) => byTimeKey(a).localeCompare(byTimeKey(b)));
const overdue = () => state.tasks.filter((t) => !t.repeat && !t.done && t.date && t.date < today());

// ---------- commands ----------
const out = [];
const print = (s = '') => out.push(s);

const commands = {
  async login(args) {
    const c = parseCode(args[0]);
    if (!c) fail('Usage: planner login <url#token>, e.g. planner login http://192.168.1.5:18787#3f9a...');
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ code: args[0].trim() }, null, 2), { mode: 0o600 });
    await load();
    print(`Connected to ${c.url}: ${state.tasks.length} tasks. Saved to ${CONFIG_FILE}`);
  },

  async status(args, opt) {
    await load();
    const info = { server: config().url, tasks: state.tasks.length, timezone: process.env.TZ || 'system', today: today(), rev: state.rev };
    if (opt.json) return print(JSON.stringify(info, null, 2));
    print(`Server ${info.server} · ${info.tasks} tasks · rev ${info.rev} · today ${info.today} (${info.timezone})`);
  },

  async today(args, opt) {
    await load();
    const d = today();
    const od = overdue().sort((a, b) => a.date.localeCompare(b.date));
    const list = onDay(d);
    if (opt.json) return print(JSON.stringify({ today: d, overdue: od.map((t) => json(t)), tasks: list.map((t) => json(t, d)) }, null, 2));
    print(`今天 ${dayLabel(d)}`);
    if (od.length) {
      print(`\n已过期 ${od.length}`);
      od.forEach((t) => print(line(t)));
    }
    const open = list.filter((t) => !(t.repeat ? t.doneDates.includes(d) : t.done));
    print(`\n今天 ${list.length - open.length}/${list.length} 完成`);
    list.forEach((t) => print(line(t, d)));
    if (!list.length && !od.length) print('（今天没有任务）');
  },

  async list(args, opt) {
    await load();
    let days = null;
    let pick;
    if (opt.date) days = [toDate(opt.date)];
    else if (opt.from || opt.to) {
      const from = toDate(opt.from || today());
      const to = toDate(opt.to || addDays(from, 6));
      days = [];
      for (let d = from; d <= to && days.length < 370; d = addDays(d, 1)) days.push(d);
    } else if (opt.week) {
      const m = mondayOf(today());
      days = Array.from({ length: 7 }, (_, i) => addDays(m, i));
    } else if (opt.overdue) pick = overdue();
    else if (opt.undated) pick = state.tasks.filter((t) => !t.date && !t.repeat);
    else pick = state.tasks.slice();

    const keep = (t, d) => opt.done || !(t.repeat && d ? t.doneDates.includes(d) : t.done);
    if (days) {
      const res = days.map((d) => ({ date: d, tasks: onDay(d).filter((t) => keep(t, d)) }));
      if (opt.json) return print(JSON.stringify(res.map((r) => ({ date: r.date, tasks: r.tasks.map((t) => json(t, r.date)) })), null, 2));
      for (const r of res) {
        print(`${dayLabel(r.date)}`);
        r.tasks.forEach((t) => print('  ' + line(t, r.date)));
        if (!r.tasks.length) print('  （无）');
      }
      return;
    }
    const list = pick.filter((t) => keep(t)).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || byTimeKey(a).localeCompare(byTimeKey(b)));
    if (opt.json) return print(JSON.stringify(list.map((t) => json(t)), null, 2));
    list.forEach((t) => print(line(t)));
    if (!list.length) print('（没有任务）');
  },

  async show(args, opt) {
    await load();
    const t = find(args[0]);
    if (opt.json) return print(JSON.stringify(json(t), null, 2));
    print(line(t));
    if (t.note) print(`备注: ${t.note}`);
    if (t.repeat) {
      const next = nextOccurrence(t, today());
      print(`重复: ${repeatLabel(t.repeat, t.date, true)} · 开始 ${t.date} · 下一次 ${next || '已结束'} · 已完成 ${t.doneDates.length} 次`);
    }
    if (t.remind != null && t.time) print(`提醒: ${t.remind ? `提前 ${t.remind} 分钟` : '准时'}`);
    const kids = children(t.id);
    if (kids.length) {
      print('子任务:');
      kids.forEach((c) => print('  ' + line(c)));
    }
  },

  async search(args, opt) {
    await load();
    const words = args.join(' ').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) fail('Usage: planner search <words...>');
    const hits = state.tasks.filter((t) => words.every((w) => `${t.title}\n${t.note}`.toLowerCase().includes(w)));
    if (opt.json) return print(JSON.stringify(hits.map((t) => json(t)), null, 2));
    hits.forEach((t) => print(line(t)));
    if (!hits.length) print('（没有找到）');
  },

  async add(args, opt) {
    const text = args.join(' ').trim();
    if (!text) fail('Usage: planner add <text...>');
    await load();
    const p = opt.raw ? { title: text, date: '', time: '', repeat: '' } : parseInput(text);
    const task = {
      id: randomUUID(),
      title: p.title,
      note: opt.note ?? '',
      date: p.date,
      time: p.time,
      important: false,
      urgent: false,
      done: false,
      dropped: false,
      createdAt: Date.now(),
      doneAt: null,
      repeat: p.repeat,
      doneDates: [],
      skipDates: [],
      remind: null,
      parentId: '',
    };
    if (opt.date !== undefined) task.date = toDate(opt.date);
    if (opt.time !== undefined) task.time = toTime(opt.time);
    if (opt.repeat !== undefined) {
      const r = toRepeat(opt.repeat, task.date);
      task.repeat = r.repeat;
      if (r.date && opt.date === undefined) task.date = r.date;
    }
    if (task.repeat && !task.date) task.date = today();
    if (task.time && !task.date) task.date = today();
    if (opt.parent) {
      const parent = find(opt.parent);
      if (parent.parentId) fail('Subtasks cannot have subtasks (only one level)');
      task.parentId = parent.id;
      Object.assign(task, { important: parent.important, urgent: parent.urgent });
      if (task.repeat) fail('Subtasks cannot repeat');
    }
    Object.assign(task, toQuadrant(opt.quadrant ?? (task.parentId ? quadrantOf(task) : 4)));
    task.remind = opt.remind !== undefined ? toRemind(opt.remind) : task.time ? 0 : null;
    await push([task]);
    const saved = state.tasks.find((t) => t.id === task.id);
    if (opt.json) return print(JSON.stringify(json(saved), null, 2));
    print(`Added: ${line(saved, saved.repeat ? occOf(saved, {}) : '')}`);
  },

  async done(args, opt) {
    await setDone(args, opt, true);
  },
  async undone(args, opt) {
    await setDone(args, opt, false);
  },

  async skip(args, opt) {
    await load();
    const t = find(args[0]);
    if (!t.repeat) fail('skip is for repeating tasks; use drop or edit --date for one-off tasks');
    const d = occOf(t, opt);
    if (!t.skipDates.includes(d)) t.skipDates.push(d);
    await push([t]);
    print(`Skipped ${t.title} on ${dayLabel(d)}`);
  },

  async drop(args) {
    await load();
    const t = find(args[0]);
    if (t.repeat) fail('Repeating tasks cannot be dropped; use skip for one day, or edit --repeat "~YYYY-MM-DD" to end it');
    Object.assign(t, { done: true, dropped: true, doneAt: Date.now() });
    await push([t]);
    print(`Dropped: ${t.title}`);
  },

  async restore(args) {
    await load();
    const t = find(args[0]);
    Object.assign(t, { done: false, dropped: false, doneAt: null });
    await push([t]);
    print(`Restored: ${line(t)}`);
  },

  async edit(args, opt) {
    await load();
    const t = find(args[0]);
    const changes = [];
    if (opt.title !== undefined) {
      if (!opt.title.trim()) fail('--title cannot be empty');
      t.title = opt.title.trim();
      changes.push('title');
    }
    if (opt.date !== undefined) {
      t.date = toDate(opt.date);
      if (!t.date) Object.assign(t, { time: '', repeat: '' });
      changes.push('date');
    }
    if (opt.time !== undefined) {
      t.time = toTime(opt.time);
      if (t.time && !t.date) t.date = today();
      if (t.time && t.remind == null) t.remind = 0;
      changes.push('time');
    }
    if (opt.repeat !== undefined) {
      if (t.parentId && opt.repeat) fail('Subtasks cannot repeat');
      // "~YYYY-MM-DD" alone: keep the rule, set an end date
      if (/^~\d{4}-\d{2}-\d{2}$/.test(opt.repeat) && t.repeat) t.repeat = t.repeat.replace(/~.*$/, '') + opt.repeat;
      else t.repeat = toRepeat(opt.repeat, t.date).repeat;
      if (t.repeat && !t.date) t.date = today();
      changes.push('repeat');
    }
    if (opt.quadrant !== undefined) {
      Object.assign(t, toQuadrant(opt.quadrant));
      changes.push('quadrant');
    }
    if (opt.note !== undefined) {
      t.note = opt.note;
      changes.push('note');
    }
    if (opt.remind !== undefined) {
      t.remind = toRemind(opt.remind);
      changes.push('remind');
    }
    if (!changes.length) fail('Nothing to change. Options: --title --date --time --repeat --quadrant --note --remind');
    if (t.repeat && !parseRule(t.repeat)) fail(`Invalid repeat rule ${t.repeat}`);
    await push([t]);
    print(`Updated ${changes.join(', ')}: ${line(t)}`);
  },

  async delete(args) {
    await load();
    const t = find(args[0]);
    const now = Date.now();
    const gone = [t, ...children(t.id)];
    await push([], Object.fromEntries(gone.map((x) => [x.id, now])));
    print(`Deleted: ${t.title}${gone.length > 1 ? ` and ${gone.length - 1} subtask(s)` : ''}`);
  },

  help() {
    print(HELP);
  },
};

async function setDone(args, opt, value) {
  await load();
  const t = find(args[0]);
  if (t.repeat) {
    const d = occOf(t, opt);
    const has = t.doneDates.includes(d);
    if (value && !has) t.doneDates.push(d);
    if (!value && has) t.doneDates.splice(t.doneDates.indexOf(d), 1);
    await push([t]);
    return print(`${value ? 'Done' : 'Not done'}: ${t.title} on ${dayLabel(d)}`);
  }
  Object.assign(t, { done: value, dropped: false, doneAt: value ? Date.now() : null });
  await push([t]);
  print(`${value ? 'Done' : 'Not done'}: ${t.title}`);
}

// ---------- main ----------
const { cmd, args, opt } = parseArgs(process.argv.slice(2));
const run = commands[cmd === '--help' || cmd === '-h' || opt.help ? 'help' : cmd];
if (!run) {
  console.error(`Unknown command "${cmd}".\n\n${HELP}`);
  process.exit(2);
}
try {
  await run(args, opt);
  console.log(out.join('\n'));
} catch (e) {
  console.error(e instanceof UsageError ? e.message : e.stack || e.message);
  process.exit(1);
}
