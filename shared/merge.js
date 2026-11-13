// Sync merge shared by the app, the sync server and the agent CLI. Pure, no imports.
//
// State shape: { tasks: Task[], deleted: { [id]: ms }, meta?: { tz } }
// Every task carries updatedAt (ms). Merge is per task: the newer updatedAt wins.
// A tombstone (deleted[id] = ms) wins over a task that was not edited after it;
// a task edited after its tombstone (an undo, or an edit on another device) brings it back.

const TOMBSTONE_TTL = 90 * 864e5;

// Everything except updatedAt: used to tell whether a task really changed
export function taskSig(t) {
  const { updatedAt, ...rest } = t;
  return JSON.stringify(rest);
}

const newer = (x, y) => {
  const a = x.updatedAt || 0;
  const b = y.updatedAt || 0;
  return a !== b ? a > b : taskSig(x) > taskSig(y); // tie: pick deterministically so both sides agree
};

export function mergeState(a, b, now = Date.now()) {
  const deleted = { ...(a.deleted || {}) };
  for (const [id, at] of Object.entries(b.deleted || {})) if (!(deleted[id] >= at)) deleted[id] = at;

  const byId = new Map();
  const order = [];
  for (const t of [...(a.tasks || []), ...(b.tasks || [])]) {
    const cur = byId.get(t.id);
    if (!cur) order.push(t.id);
    if (!cur || newer(t, cur)) byId.set(t.id, t);
  }

  const tasks = [];
  for (const id of order) {
    const t = byId.get(id);
    const gone = deleted[id];
    if (gone && gone >= (t.updatedAt || 0)) continue;
    if (gone) delete deleted[id];
    tasks.push(t);
  }
  // A subtask whose parent is gone goes too
  const ids = new Set(tasks.map((t) => t.id));
  const kept = tasks.filter((t) => !t.parentId || ids.has(t.parentId));

  for (const [id, at] of Object.entries(deleted)) if (now - at > TOMBSTONE_TTL) delete deleted[id];
  return { tasks: kept, deleted, meta: { ...(a.meta || {}), ...(b.meta || {}) } };
}
