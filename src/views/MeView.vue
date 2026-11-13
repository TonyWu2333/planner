<script setup>
import { ref, computed } from 'vue';
import Icon from '../components/Icon.vue';
import { state, tasksOn } from '../lib/store.js';
import { today, addDays, mondayOf, parseYmd, ymd, WEEKDAY } from '../lib/date.js';
import { exportBackup, importBackup } from '../lib/backup.js';
import { REMIND_OPTIONS, remindLabel, notifyState } from '../lib/notify.js';
import { haptic, toast } from '../lib/ui.js';
import { syncState, syncNow, parseCode } from '../lib/sync.js';

// 由 vite.config.js 注入（来自 package.json）
const version = __APP_VERSION__;
const td = computed(() => today());
const todayTasks = computed(() => tasksOn(td.value));
// 放弃的任务不算进今天的进度（既不算完成，也不算总数）
const todayCounted = computed(() => todayTasks.value.filter((t) => !t.dropped));
const todayDone = computed(() => todayCounted.value.filter((t) => t.done).length);
const ratio = computed(() => (todayCounted.value.length ? todayDone.value / todayCounted.value.length : 0));
// 重复任务只算今天这一次
const pendingAll = computed(
  () => state.tasks.filter((t) => !t.repeat && !t.done).length + todayTasks.value.filter((t) => t.repeat && !t.done).length,
);
const overdue = computed(() => state.tasks.filter((t) => !t.repeat && !t.done && t.date && t.date < td.value).length);
const weekDone = computed(() => {
  const start = mondayOf(td.value);
  return doneDays.value.filter((d) => d >= start && d <= td.value).length;
});

// 每一次完成的日期：普通任务看 doneAt，重复任务看 doneDates
const doneDays = computed(() =>
  state.tasks.flatMap((t) => (t.repeat ? t.doneDates : t.doneAt && !t.dropped ? [ymd(new Date(t.doneAt))] : [])),
);
// 最近 7 天每天完成数
const last7 = computed(() => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(td.value, i - 6));
  const counts = Object.fromEntries(days.map((d) => [d, 0]));
  for (const d of doneDays.value) if (d in counts) counts[d]++;
  const max = Math.max(1, ...Object.values(counts));
  return days.map((d) => ({ d, n: counts[d], h: counts[d] / max, label: d === td.value ? '今' : WEEKDAY[parseYmd(d).getDay()] }));
});

const greeting = computed(() => {
  const h = new Date().getHours();
  return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
});
const summary = computed(() => {
  const left = todayCounted.value.length - todayDone.value;
  if (!todayCounted.value.length) return '今天还没有安排任务';
  if (!left) return '今天的任务全部完成了，真棒';
  return `今天还有 ${left} 个任务待完成`;
});

const fileInput = ref(null);
async function onExport() {
  haptic.light();
  try {
    await exportBackup();
  } catch (e) {
    toast('导出失败：' + e.message);
  }
}
async function onImport(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const r = await importBackup(f);
  if (r.message) toast(r.message);
  if (r.ok) haptic.success();
}
function cycleDefaultRemind() {
  haptic.select();
  const i = REMIND_OPTIONS.indexOf(state.settings.defaultRemind);
  state.settings.defaultRemind = REMIND_OPTIONS[(i + 1) % REMIND_OPTIONS.length];
}
function toggle(key) {
  haptic.select();
  state.settings[key] = !state.settings[key];
}

// ---- 同步 ----
const codeOk = computed(() => !!parseCode(state.settings.syncCode));
const syncHost = computed(() => parseCode(state.settings.syncCode)?.url.replace(/^https?:\/\//, '') ?? '');
const syncStatus = computed(() => {
  if (!state.settings.syncOn) return '';
  if (!codeOk.value) return state.settings.syncCode ? '连接码格式不对：应该是 地址#令牌' : '填入服务器启动时打印的连接码';
  if (syncState.busy) return '正在同步…';
  if (syncState.error) return `同步失败：${syncState.error}`;
  if (syncState.at) {
    const d = new Date(syncState.at);
    return `已同步 · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${syncHost.value}`;
  }
  return '还没同步过';
});
function toggleSync() {
  toggle('syncOn');
  if (state.settings.syncOn) syncNow();
}
function onCodeChange(e) {
  state.settings.syncCode = e.target.value.trim();
  if (codeOk.value) syncNow();
}
async function onSyncNow() {
  haptic.light();
  await syncNow();
  toast(syncState.error ? `同步失败：${syncState.error}` : '同步完成');
}
</script>

<template>
  <div class="meview scroll">
    <header class="page-header"><h1>我的</h1></header>

    <section class="hero">
      <div class="hero-text">
        <p class="hero-hi">{{ greeting }}</p>
        <p class="hero-sum">{{ summary }}</p>
        <div class="hero-bar"><i :style="{ width: ratio * 100 + '%' }" /></div>
        <p class="hero-num num">{{ todayDone }} / {{ todayCounted.length }} 已完成</p>
      </div>
    </section>

    <section class="stats">
      <div class="stat"><b class="num">{{ weekDone }}</b><span>本周完成</span></div>
      <div class="stat"><b class="num">{{ pendingAll }}</b><span>待办总数</span></div>
      <div class="stat" :class="{ warn: overdue }"><b class="num">{{ overdue }}</b><span>已过期</span></div>
    </section>

    <section class="card">
      <div class="card-head"><b>近 7 天完成</b><span class="num">共 {{ last7.reduce((s, x) => s + x.n, 0) }} 个</span></div>
      <div class="bars">
        <div v-for="x in last7" :key="x.d" class="bar" :class="{ today: x.d === td }">
          <span class="bar-n num">{{ x.n || '' }}</span>
          <i :style="{ height: Math.max(x.h * 100, 4) + '%' }" />
          <span class="bar-l">{{ x.label }}</span>
        </div>
      </div>
    </section>

    <div class="group-title">日历显示</div>
    <section class="list">
      <button class="li" @click="toggle('showLunar')">
        <span class="li-ico" style="--c: #8b5cf6"><Icon name="lunar" /></span>
        <span class="li-main">农历与节气</span>
        <span class="switch" :class="{ on: state.settings.showLunar }"><i /></span>
      </button>
      <button class="li" @click="toggle('showHoliday')">
        <span class="li-ico" style="--c: #ef4444"><Icon name="holiday" /></span>
        <span class="li-main">法定节假日与调休</span>
        <span class="switch" :class="{ on: state.settings.showHoliday }"><i /></span>
      </button>
    </section>

    <div class="group-title">提醒</div>
    <section class="list">
      <button class="li" @click="toggle('remindOn')">
        <span class="li-ico" style="--c: #f59e0b"><Icon name="bell" /></span>
        <span class="li-main">到点提醒<small>设了时间的任务会发系统通知，App 关着也会响</small></span>
        <span class="switch" :class="{ on: state.settings.remindOn }"><i /></span>
      </button>
      <button class="li" :disabled="!state.settings.remindOn" @click="cycleDefaultRemind">
        <span class="li-ico" style="--c: #4b5cf0"><Icon name="clock" /></span>
        <span class="li-main">新任务默认提醒<small>点一下切换；单个任务可以在详情里改</small></span>
        <span class="li-val">{{ remindLabel(state.settings.defaultRemind) }}</span>
      </button>
    </section>
    <p v-if="state.settings.remindOn && notifyState.permission === 'denied'" class="li-warn">
      通知权限没开，提醒发不出来：系统设置 → 应用 → 每日计划 → 通知，打开“允许通知”。
    </p>

    <div class="group-title">数据</div>
    <section class="list">
      <button class="li" @click="onExport">
        <span class="li-ico" style="--c: #0ea5e9"><Icon name="upload" /></span>
        <span class="li-main">导出备份<small>生成 JSON 文件，发到微信或网盘保存</small></span>
        <Icon name="chevron-right" class="li-arrow" />
      </button>
      <button class="li" @click="fileInput.click()">
        <span class="li-ico" style="--c: #10b981"><Icon name="download" /></span>
        <span class="li-main">从备份恢复<small>会替换当前全部 {{ state.tasks.length }} 条任务</small></span>
        <Icon name="chevron-right" class="li-arrow" />
      </button>
      <input ref="fileInput" type="file" hidden @change="onImport" />
    </section>

    <div class="group-title">同步与 Agent</div>
    <section class="list">
      <button class="li" @click="toggleSync">
        <span class="li-ico" style="--c: #6366f1"><Icon name="cloud" /></span>
        <span class="li-main">同步到自己的服务器<small>让电脑或服务器上的 agent（Claude Code、Codex、Hermes）也能看和改你的任务</small></span>
        <span class="switch" :class="{ on: state.settings.syncOn }"><i /></span>
      </button>
      <template v-if="state.settings.syncOn">
        <label class="li sync-code">
          <span class="li-main">连接码<small>服务器启动时会打印，格式是 地址#令牌</small></span>
          <input
            :value="state.settings.syncCode"
            type="text"
            inputmode="url"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            placeholder="http://192.168.1.5:18787#…"
            @change="onCodeChange"
          />
        </label>
        <button class="li" :disabled="!codeOk || syncState.busy" @click="onSyncNow">
          <span class="li-main">立即同步<small :class="{ err: syncState.error || (state.settings.syncCode && !codeOk) }">{{ syncStatus }}</small></span>
          <Icon name="chevron-right" class="li-arrow" />
        </button>
      </template>
    </section>

    <section class="list note-card">
      <div class="li static">
        <span class="li-ico" style="--c: #64748b"><Icon name="shield" /></span>
        <span v-if="state.settings.syncOn" class="li-main">数据保存在本机和你自己的服务器<small>不经过任何第三方。连接码里有令牌，别发给别人。</small></span>
        <span v-else class="li-main">数据只保存在本机<small>不联网、不上传。卸载 App 或清除应用数据会一起删除，建议定期导出备份。</small></span>
      </div>
    </section>
    <p class="ver">每日计划 · v{{ version }}</p>
  </div>
</template>

<style>
.meview { height: 100%; padding-bottom: 24px; }
.hero {
  margin: 0 16px; padding: 20px; border-radius: var(--r-lg); color: #fff;
  background: radial-gradient(120% 140% at 100% 0%, #8b5cf6 0%, transparent 55%), linear-gradient(135deg, #4b5cf0, #6d5cf0);
  box-shadow: 0 14px 30px -12px rgba(75, 92, 240, .55);
}
.hero-hi { margin: 0; font-size: 14px; opacity: .85; }
.hero-sum { margin: 4px 0 16px; font-size: 20px; font-weight: 700; }
.hero-bar { height: 6px; border-radius: 3px; background: rgba(255, 255, 255, .25); overflow: hidden; }
.hero-bar i { display: block; height: 100%; border-radius: inherit; background: #fff; transition: width .6s var(--ease); }
.hero-num { margin: 8px 0 0; font-size: 12.5px; opacity: .85; }

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 16px 0; }
.stat { padding: 14px 12px; border-radius: var(--r-md); background: var(--surface); box-shadow: var(--shadow-1); display: flex; flex-direction: column; gap: 2px; }
.stat b { font-size: 24px; font-weight: 700; line-height: 1.1; }
.stat span { font-size: 12px; color: var(--text-3); }
.stat.warn b { color: var(--danger); }

.card { margin: 12px 16px 0; padding: 16px; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--shadow-1); }
.card-head { display: flex; justify-content: space-between; align-items: baseline; }
.card-head b { font-size: 15px; font-weight: 650; }
.card-head span { font-size: 12px; color: var(--text-3); }
.bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; height: 120px; margin-top: 12px; }
.bar { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; min-height: 0; }
.bar i { width: 100%; max-width: 22px; border-radius: 6px; background: var(--fill-2); transition: height .6s var(--ease); }
.bar.today i { background: var(--accent); }
.bar-n { font-size: 11px; color: var(--text-3); height: 14px; }
.bar-l { font-size: 11.5px; color: var(--text-3); }
.bar.today .bar-l, .bar.today .bar-n { color: var(--accent); font-weight: 600; }

.group-title { margin: 22px 32px 8px; font-size: 13px; font-weight: 600; color: var(--text-3); }
.list { margin: 0 16px; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--shadow-1); overflow: hidden; }
.li { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 10px 14px; text-align: left; }
.li:not(.static):active { background: var(--fill); }
.li + .li { border-top: 1px solid var(--sep); }
.li-ico { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; flex: none; background: var(--c); color: #fff; }
.li-ico .icon { width: 18px; height: 18px; stroke-width: 2; }
.li-main { flex: 1; min-width: 0; font-size: 15.5px; }
.li-main small { display: block; font-size: 12px; color: var(--text-3); margin-top: 1px; line-height: 1.45; }
.li-arrow { width: 16px; height: 16px; color: var(--text-3); }
.note-card { margin-top: 12px; }
.li.static { align-items: flex-start; }
.switch { position: relative; width: 50px; height: 30px; border-radius: 15px; background: var(--fill-2); transition: background-color .25s; flex: none; }
.switch i { position: absolute; top: 2px; left: 2px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, .2); transition: transform .3s var(--spring); }
.switch.on { background: var(--accent); }
.switch.on i { transform: translateX(20px); }
.ver { text-align: center; font-size: 12px; color: var(--text-3); margin: 20px 0 8px; }
.li-val { flex: none; font-size: 14.5px; color: var(--accent); font-weight: 550; }
.li:disabled { opacity: .45; }
.sync-code { flex-direction: column; align-items: stretch; gap: 8px; }
.sync-code input { height: 40px; padding: 0 12px; border: 0; outline: 0; border-radius: 10px; background: var(--surface-2); font: inherit; font-size: 14px; color: var(--text); font-family: ui-monospace, Menlo, monospace; }
.sync-code input:focus { box-shadow: 0 0 0 2px var(--accent); }
.li-main small.err { color: var(--danger); }
.li-warn { margin: -4px 20px 12px; font-size: 12.5px; line-height: 1.5; color: var(--danger); }
</style>
