// 和自建同步服务器（server/server.js）同步，让电脑或服务器上的 agent（Claude Code、Codex、Hermes…）
// 也能读写任务。整份数据双向合并，按每条任务的 updatedAt 取新的（shared/merge.js）。
//
// 什么时候同步：打开 App、回到前台、本地改了东西 2 秒后、前台每分钟一次；
// 另外前台时一直挂着一个长轮询（/api/wait），服务器上有变化（比如 agent 改了任务）马上同步。
// 设置里填一个「连接码」：服务器地址#令牌，比如 http://192.168.1.5:18787#3f9a...（服务器启动时会打印出来）。
import { reactive } from 'vue';
import { state, syncPayload, applyRemote, onLocalChange } from './store.js';

export const syncState = reactive({ busy: false, at: 0, error: '' });

export function parseCode(code) {
  const m = String(code ?? '').trim().match(/^(https?:\/\/[^\s#]+?)\/?#([A-Za-z0-9._~-]{16,})$/);
  return m ? { url: m[1], token: m[2] } : null;
}
const conf = () => (state.settings.syncOn ? parseCode(state.settings.syncCode) : null);

let again = false;
export async function syncNow() {
  const c = conf();
  if (!c) return;
  if (syncState.busy) {
    again = true; // 正在同步时又有改动：这次结束后再来一次
    return;
  }
  syncState.busy = true;
  try {
    const body = { ...syncPayload(), meta: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone } };
    const res = await withTimeout(
      fetch(`${c.url}/api/sync`, {
        method: 'POST',
        headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      15000,
    );
    if (res.status === 401) throw new Error('令牌不对');
    if (!res.ok) throw new Error(`服务器返回 ${res.status}`);
    const remote = await res.json();
    applyRemote(remote);
    lastRev = remote.rev;
    syncState.at = Date.now();
    syncState.error = '';
    watchServer();
  } catch (e) {
    syncState.error = e.message === 'timeout' ? '连不上服务器' : /fetch|network|connect/i.test(e.message) ? '连不上服务器' : e.message;
  } finally {
    syncState.busy = false;
    if (again) {
      again = false;
      syncNow();
    }
  }
}

// ---- 长轮询：服务器的数据版本（rev）一变就同步 ----
let lastRev = -1;
let watching = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function watchServer() {
  if (watching) return;
  watching = true;
  let backoff = 2000;
  while (document.visibilityState === 'visible' && conf()) {
    const c = conf();
    try {
      const res = await withTimeout(
        fetch(`${c.url}/api/wait?rev=${lastRev}`, { headers: { authorization: `Bearer ${c.token}` } }),
        40000,
      );
      if (!res.ok) throw new Error(String(res.status));
      const { rev } = await res.json();
      backoff = 2000;
      if (rev !== lastRev) {
        await syncNow();
        if (lastRev !== rev) await sleep(backoff); // 同步没成功（或正忙），别原地打转
      }
    } catch {
      await sleep(backoff); // 连不上：等一会儿再试，越等越久，最多 30 秒
      backoff = Math.min(backoff * 2, 30000);
    }
  }
  watching = false;
}

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

let debounce;
export function initSync() {
  onLocalChange(() => {
    clearTimeout(debounce);
    debounce = setTimeout(syncNow, 2000);
  });
  setInterval(() => document.visibilityState === 'visible' && syncNow(), 60000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && watchServer());
  syncNow();
}
