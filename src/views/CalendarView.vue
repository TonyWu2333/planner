<script setup>
import { ref, computed } from 'vue';
import Icon from '../components/Icon.vue';
import MonthGrid from '../components/MonthGrid.vue';
import TaskRow from '../components/TaskRow.vue';
import EmptyArt from '../components/EmptyArt.vue';
import MonthPicker from '../components/MonthPicker.vue';
import { state, toggleDone, removeTask, updateTask, tasksOn, skipOccurrence, childrenOf } from '../lib/store.js';
import { occursOn } from '../lib/repeat.js';
import { today, addDays, parseYmd, ymd, diffDays, dayInfo, dateLabel, lunarYearLabel, WEEKDAY, mondayOf } from '../lib/date.js';
import { quadrantOf, byTime, byDate } from '../lib/quadrant.js';
import { haptic, toast, clickGuard } from '../lib/ui.js';

const emit = defineEmits(['open', 'add', 'search']);

const selected = ref(today());
const mode = ref('month'); // 'month' | 'week'

const sel = computed(() => parseYmd(selected.value));
const year = computed(() => sel.value.getFullYear());
const month = computed(() => sel.value.getMonth());

// ---- 三页常驻的滑动轨道：上一页 / 当前 / 下一页 ----
// 切月不再销毁重建 DOM（那样每次都要新建 GPU 图层，真机上会掉帧），
// 而是拖动同一条轨道，松手后把数据换成下一页、轨道归零。
const rowH = computed(() => (state.settings.showLunar ? 54 : 46));
function geom(d) {
  const p = parseYmd(d);
  const y = p.getFullYear();
  const m = p.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  return {
    date: d,
    year: y,
    month: m,
    rows: Math.ceil((offset + new Date(y, m + 1, 0).getDate()) / 7),
    row: Math.floor((offset + p.getDate() - 1) / 7),
  };
}
const override = ref(null); // { n, date }：点了相邻月份的某天，滑过去的那页直接选中它
function neighbour(n) {
  if (override.value?.n === n) return override.value.date;
  if (mode.value === 'week') return addDays(selected.value, 7 * n);
  const first = ymd(new Date(year.value, month.value + n, 1));
  return today().startsWith(first.slice(0, 7)) ? today() : first;
}
const panes = computed(() => [-1, 0, 1].map((n) => geom(n ? neighbour(n) : selected.value)));
// 三个固定槽位轮换：每页按“第几个月/第几周”取模 3 固定在某个槽里。
// 翻一页时另外两页的 DOM 和 GPU 图层原样保留、只是挪位置，只有一页需要重画（而且在屏幕外）。
const mod3 = (k) => ((k % 3) + 3) % 3;
const pageIndex = (p) =>
  mode.value === 'week' ? Math.floor(diffDays(mondayOf(p.date), '2000-01-03') / 7) : p.year * 12 + p.month;
const slots = computed(() => {
  const out = [];
  panes.value.forEach((p, i) => (out[mod3(pageIndex(p))] = { ...p, n: i - 1 }));
  return out;
});
// 月 ⇄ 周只用位移，不改任何高度（改高度每帧都要重排下面的列表、重建 GPU 图层，真机上很卡）：
// 视口固定一行高；月视图时把下面的把手和日程列表整体往下推 drop，
// 周视图时网格上移到选中行，多出来的行藏在标题栏和日程列表下面。
const drop = computed(() => (mode.value === 'month' ? (panes.value[1].rows - 1) * rowH.value : 0));
const shiftOf = (p) => (mode.value === 'month' ? 0 : -p.row * rowH.value);

// ---- 每天的彩色小圆点（覆盖三页能看到的所有日子） ----
const dots = computed(() => {
  const m = new Map();
  const byDay = new Map();
  const add = (d, t) => {
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(t);
  };
  const days = new Set();
  for (const p of panes.value) {
    const start = mondayOf(`${p.year}-${String(p.month + 1).padStart(2, '0')}-01`);
    for (let i = 0; i < 42; i++) days.add(addDays(start, i));
  }
  for (const t of state.tasks) {
    if (t.repeat) {
      for (const d of days) if (occursOn(t, d)) add(d, { ...t, done: t.doneDates.includes(d) });
    } else if (t.date) add(t.date, t);
  }
  for (const [d, list] of byDay) {
    const open = list.filter((t) => !t.done).map(quadrantOf).sort();
    m.set(d, open.length ? open.slice(0, 3) : ['done']);
  }
  return m;
});

// ---- 轨道动画 ----
const vp = ref(null);
const tx = ref(0);
const animating = ref(false);
const instant = ref(false); // 换数据的那一帧关掉所有过渡（行位移、淡入淡出），否则会看到第二段动画
let sliding = false;
const SLIDE_MS = 340;
function slideTo(n, target) {
  if (sliding) return;
  sliding = true;
  if (target) override.value = { n, date: target };
  haptic.select();
  animating.value = true;
  tx.value = -n * vp.value.clientWidth;
  setTimeout(() => {
    instant.value = true;
    selected.value = panes.value[n + 1].date;
    override.value = null;
    animating.value = false; // 同一帧里换数据 + 归零，看不出跳动
    tx.value = 0;
    sliding = false;
    requestAnimationFrame(() => requestAnimationFrame(() => (instant.value = false)));
  }, SLIDE_MS);
}
function snapBack() {
  animating.value = true;
  tx.value = 0;
}
// 跳到任意日期：相邻页就滑过去，否则直接换
function go(date) {
  if (date === selected.value) return;
  for (const n of [-1, 1]) {
    const p = geom(neighbour(n));
    const same = mode.value === 'week' ? mondayOf(p.date) === mondayOf(date) : p.date.slice(0, 7) === date.slice(0, 7);
    if (same) return slideTo(n, date);
  }
  haptic.select();
  selected.value = date;
}
const shift = (n) => slideTo(n);
function goToday() {
  const t = today();
  const visible = mode.value === 'week' ? mondayOf(t) === mondayOf(selected.value) : t.slice(0, 7) === selected.value.slice(0, 7);
  if (visible) {
    haptic.select();
    selected.value = t;
  } else go(t);
}
// 年月选择
const picker = ref(false);
function openPicker() {
  haptic.select();
  picker.value = true;
}
function pickMonth(y, m) {
  picker.value = false;
  const key = `${y}-${String(m + 1).padStart(2, '0')}`;
  if (key === selected.value.slice(0, 7)) return;
  go(today().startsWith(key) ? today() : `${key}-01`);
}
function pickToday() {
  picker.value = false;
  goToday();
}
function onSelect(d) {
  if (Date.now() < clickGuard.until) return;
  if (mode.value === 'month' && d.slice(0, 7) !== selected.value.slice(0, 7)) return go(d);
  haptic.select();
  selected.value = d;
}
function setMode(m) {
  if (mode.value === m) return;
  haptic.light();
  mode.value = m;
}

// 日历区域：左右拖动跟手换月/周，上下滑折叠/展开
let sw = null;
function swDown(e) {
  if (sliding) return;
  sw = { x: e.clientX, y: e.clientY, t: performance.now(), dir: null, id: e.pointerId };
}
function swMove(e) {
  if (!sw) return;
  const dx = e.clientX - sw.x;
  const dy = e.clientY - sw.y;
  if (!sw.dir) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    sw.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (sw.dir === 'h') {
      animating.value = false;
      try {
        vp.value.setPointerCapture(sw.id);
      } catch {
        /* 指针已经抬起 */
      }
    }
  }
  if (sw.dir === 'h') tx.value = dx;
}
function swUp(e) {
  if (!sw) return;
  const { dir, x, y, t } = sw;
  sw = null;
  const dx = e.clientX - x;
  const dy = e.clientY - y;
  if (dir === 'h') {
    clickGuard.until = Date.now() + 250;
    const v = Math.abs(dx) / (performance.now() - t);
    if (Math.abs(dx) > vp.value.clientWidth * 0.22 || (v > 0.4 && Math.abs(dx) > 30)) slideTo(dx < 0 ? 1 : -1);
    else snapBack();
  } else if (dir === 'v' && Math.abs(dy) > 35) {
    clickGuard.until = Date.now() + 250;
    setMode(dy < 0 ? 'week' : 'month');
  }
}

// 日程列表：上滑收成周视图（任务少、列表滚不动时也行）；在顶部下拉展开月视图
const agenda = ref(null);
let touch = null;
function onAgendaScroll() {
  if (agenda.value.scrollTop > 12 && mode.value === 'month') setMode('week');
}
function onAgendaTouchStart(e) {
  touch = { y: e.touches[0].clientY, atTop: agenda.value.scrollTop <= 0 };
}
function onAgendaTouchMove(e) {
  if (!touch) return;
  const dy = e.touches[0].clientY - touch.y;
  if (dy < -40 && mode.value === 'month') {
    touch = null;
    setMode('week');
  } else if (touch.atTop && dy > 60 && mode.value === 'week') {
    touch = null;
    setMode('month');
  }
}

// ---- 当天的任务 ----
const dayTasks = computed(() => tasksOn(selected.value).sort(byTime));
const openTasks = computed(() => dayTasks.value.filter((t) => !t.done));
const doneTasks = computed(() => dayTasks.value.filter((t) => t.done));
const overdue = computed(() =>
  selected.value === today() ? state.tasks.filter((t) => !t.repeat && !t.done && t.date && t.date < today()).sort(byDate) : [],
);
const showDone = ref(true);

const info = computed(() => dayInfo(selected.value));
const heading = computed(() => {
  const rel = dateLabel(selected.value);
  const md = `${sel.value.getMonth() + 1}月${sel.value.getDate()}日`;
  const isRel = ['今天', '明天', '后天', '昨天'].includes(rel);
  return {
    title: isRel ? rel : md,
    sub: [isRel && md, `周${WEEKDAY[sel.value.getDay()]}`, info.value.full].filter(Boolean).join(' · '),
  };
});
// 今天所在的星期列高亮（当前显示的范围包含今天时）
const todayCol = computed(() => {
  const t = today();
  const visible = mode.value === 'week' ? mondayOf(t) === mondayOf(selected.value) : t.slice(0, 7) === selected.value.slice(0, 7);
  return visible ? (parseYmd(t).getDay() + 6) % 7 : -1;
});
const progress = computed(() => (dayTasks.value.length ? doneTasks.value.length / dayTasks.value.length : 0));

// ---- 任务操作 ----
function onDelete(t) {
  const kids = childrenOf(t.id).length;
  const undo = removeTask(t.id);
  const extra = [t.repeat && '以后的重复', kids && `${kids} 个子任务`].filter(Boolean).join('和');
  toast(extra ? `已删除「${t.title}」及${extra}` : `已删除「${t.title}」`, { action: undo });
}
function onPostpone(t) {
  if (t.repeat) {
    const undo = skipOccurrence(t.id, t.occ);
    return toast('已跳过这一次', { action: undo });
  }
  const prev = t.date;
  const next = addDays(t.date && t.date > today() ? t.date : today(), 1);
  updateTask(t.id, { date: next });
  toast(`已推迟到${dateLabel(next)}`, { action: () => updateTask(t.id, { date: prev }) });
}
function moveOverdueToToday() {
  const prev = overdue.value.map((t) => [t.id, t.date]);
  prev.forEach(([id]) => updateTask(id, { date: today() }));
  haptic.success();
  toast(`${prev.length} 个任务已移到今天`, { action: () => prev.forEach(([id, d]) => updateTask(id, { date: d })) });
}

defineExpose({ selected });
</script>

<template>
  <div class="calview">
    <div class="cal-bg" />
    <div class="cal-head">
      <header class="cal-header">
        <button class="cal-title" aria-label="选择年月" @click="openPicker">
          <span class="cal-month num">{{ month + 1 }}<small>月</small></span>
          <span class="cal-sub"><span class="num">{{ year }}</span><em>{{ lunarYearLabel(year) }}</em></span>
          <Icon name="chevron-down" class="cal-caret" />
        </button>
        <div class="cal-tools">
          <button class="cal-search press" aria-label="搜索" @click="emit('search')"><Icon name="search" /></button>
          <Transition name="pop">
            <button v-if="selected !== today()" class="today-btn press" aria-label="回到今天" @click="goToday">今</button>
          </Transition>
          <div class="cal-nav">
            <button class="press" :aria-label="mode === 'month' ? '上个月' : '上一周'" @click="shift(-1)"><Icon name="chevron-left" /></button>
            <i />
            <button class="press" :aria-label="mode === 'month' ? '下个月' : '下一周'" @click="shift(1)"><Icon name="chevron-right" /></button>
          </div>
        </div>
      </header>

      <div class="cal-week">
        <span v-for="(w, i) in ['一', '二', '三', '四', '五', '六', '日']" :key="w" :class="{ we: i >= 5, cur: i === todayCol }">{{ w }}</span>
      </div>
    </div>


      <div
        ref="vp"
        class="cal-viewport"
        :style="{ height: rowH + 'px', clipPath: `inset(-100vh 0 ${-(drop + 6)}px 0)` }"
        @pointerdown="swDown"
        @pointermove="swMove"
        @pointerup="swUp"
        @pointercancel="swUp"
      >
        <div class="cal-track" :class="{ animating, instant }" :style="{ transform: `translate3d(${tx}px, 0, 0)` }">
          <div v-for="(p, slot) in slots" :key="slot" class="cal-pane" :style="{ transform: `translate3d(${p.n * 100}%, 0, 0)` }">
            <div class="cal-shift" :style="{ transform: `translateY(${shiftOf(p)}px)` }">
              <MonthGrid
                :year="p.year"
                :month="p.month"
                :selected="p.date"
                :lunar="state.settings.showLunar"
                :holiday="state.settings.showHoliday"
                :week-mode="mode === 'week'"
                :dots="dots"
                @select="onSelect"
              />
            </div>
          </div>
        </div>
      </div>

      <button class="cal-handle" :style="{ transform: `translate3d(0, ${drop}px, 0)` }" :aria-label="mode === 'month' ? '收起为周视图' : '展开月视图'" @click="setMode(mode === 'month' ? 'week' : 'month')">
        <i :class="mode" />
      </button>

    <div
      ref="agenda"
      class="agenda scroll"
      :style="{ transform: `translate3d(0, ${drop}px, 0)` }"
      @scroll.passive="onAgendaScroll"
      @touchstart.passive="onAgendaTouchStart"
      @touchmove.passive="onAgendaTouchMove"
    >
      <!-- 按日期 key：换一天时整体替换，不让每一行都播放入场动画 -->
      <div :key="selected" class="agenda-day">
      <div class="agenda-head">
        <div class="ah-text">
          <h2>
            {{ heading.title }}
            <span v-if="state.settings.showHoliday && info.holidayName" class="ah-tag">{{ info.holidayName }}</span>
            <span v-else-if="state.settings.showHoliday && info.holiday === '班'" class="ah-tag work">调休上班</span>
          </h2>
          <p>{{ heading.sub }}</p>
        </div>
        <div v-if="dayTasks.length" class="ring" :title="`${doneTasks.length}/${dayTasks.length}`">
          <svg viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" class="ring-bg" />
            <circle cx="18" cy="18" r="15" class="ring-fg" :style="{ strokeDashoffset: 94.25 * (1 - progress) }" />
          </svg>
          <span class="num">{{ doneTasks.length }}/{{ dayTasks.length }}</span>
        </div>
      </div>

      <!-- 已过期（只在今天显示） -->
      <section v-if="overdue.length" class="group">
        <div class="group-head danger">
          <span>已过期 · {{ overdue.length }}</span>
          <button class="link press" @click="moveOverdueToToday">全部移到今天</button>
        </div>
        <TransitionGroup tag="div" name="list" class="tlist">
          <TaskRow
            v-for="t in overdue"
            :key="t.id"
            :task="t"
            show-date
            @toggle="toggleDone(t.id, t.occ)"
            @open="emit('open', t.id, t.occ)"
            @delete="onDelete(t)"
            @postpone="onPostpone(t)"
          />
        </TransitionGroup>
      </section>

      <section v-if="openTasks.length" class="group">
        <div v-if="overdue.length" class="group-head"><span>{{ heading.title }}</span></div>
        <TransitionGroup tag="div" name="list" class="tlist">
          <TaskRow
            v-for="t in openTasks"
            :key="t.id"
            :task="t"
            @toggle="toggleDone(t.id, t.occ)"
            @open="emit('open', t.id, t.occ)"
            @delete="onDelete(t)"
            @postpone="onPostpone(t)"
          />
        </TransitionGroup>
      </section>

      <section v-if="doneTasks.length" class="group">
        <button class="group-head toggle" @click="showDone = !showDone">
          <span>已完成 · {{ doneTasks.length }}</span>
          <Icon name="chevron-down" :class="{ up: showDone }" />
        </button>
        <Transition name="collapse">
          <TransitionGroup v-if="showDone" tag="div" name="list" class="tlist">
            <TaskRow
              v-for="t in doneTasks"
              :key="t.id"
              :task="t"
              @toggle="toggleDone(t.id, t.occ)"
              @open="emit('open', t.id, t.occ)"
              @delete="onDelete(t)"
              @postpone="onPostpone(t)"
            />
          </TransitionGroup>
        </Transition>
      </section>

      <div v-if="!dayTasks.length && !overdue.length" class="empty">
        <EmptyArt />
        <b>{{ selected === today() ? '今天还没有安排' : '这天还没有安排' }}</b>
        <p>试试输入「明天下午3点开会」，自动识别时间</p>
        <button class="empty-btn press" @click="emit('add', { date: selected })"><Icon name="plus" />添加任务</button>
      </div>
      </div>
      <div class="agenda-pad" />
    </div>

    <MonthPicker :open="picker" :year="year" :month="month" @close="picker = false" @pick="pickMonth" @today="pickToday" />

    <button class="fab" aria-label="新建任务" @click="emit('add', { date: selected })">
      <Icon name="plus" />
    </button>
  </div>
</template>

<style>
.calview { position: relative; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
/* 层次：白底 < 日程列表 < 把手 < 日历网格 < 标题栏。网格在把手之上，最后一行选中日期的阴影不会被盖住 */
.cal-bg { position: absolute; inset: 0; background: var(--surface); }
.cal-head { flex: none; position: relative; z-index: 4; background: var(--surface); }
.cal-header { display: flex; align-items: center; gap: 12px; padding: var(--head-top) 14px 4px 20px; }
.cal-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; text-align: left; white-space: nowrap; }
.cal-month { font-size: 30px; font-weight: 750; letter-spacing: -.5px; line-height: 1; }
.cal-month small { font-size: 18px; font-weight: 650; margin-left: 2px; letter-spacing: 0; }
.cal-sub { display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; line-height: 1.15; color: var(--text-3); font-weight: 500; }
.cal-sub em { font-style: normal; }
.cal-caret { width: 16px; height: 16px; color: var(--text-3); stroke-width: 2.2; margin-left: -4px; }
.cal-tools { flex: none; display: flex; align-items: center; gap: 6px; }
.cal-search { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: var(--text-2); background: var(--fill); }
.cal-search .icon { width: 17px; height: 17px; stroke-width: 2.1; }
.today-btn {
  width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
  font-size: 14px; font-weight: 700; color: var(--accent); background: var(--accent-soft);
}
.cal-nav { display: flex; align-items: center; height: 32px; border-radius: 99px; background: var(--fill); }
.cal-nav button { width: 36px; height: 32px; display: grid; place-items: center; color: var(--text-2); border-radius: 99px; }
.cal-nav button:active { background: var(--fill-2); }
.cal-nav .icon { width: 18px; height: 18px; stroke-width: 2.2; }
.cal-nav i { width: 1px; height: 14px; background: var(--fill-2); }
.pop-enter-active, .pop-leave-active { transition: transform .3s var(--spring), opacity .2s; }
.pop-enter-from, .pop-leave-to { transform: scale(.5); opacity: 0; }

.cal-week { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 12px; font-weight: 500; color: var(--text-3); padding: 10px 4px 4px; }
.cal-week .we { opacity: .7; }
.cal-week .cur { color: var(--accent); opacity: 1; font-weight: 650; }
/* clip-path 只在左右裁剪：上下放出 12px，选中日期的阴影不会被最后一行截掉；相邻页不会从两侧露出来 */
/* 左右裁掉相邻页；下边界跟着 drop 一起动（多留 6px 给选中日期的阴影），上面多出的行被标题栏盖住 */
.cal-viewport { flex: none; position: relative; z-index: 3; touch-action: none; transition: clip-path .42s var(--ease); }
.cal-track { position: absolute; inset: 0; will-change: transform; }
.cal-track.animating { transition: transform .34s var(--ease); }
.cal-track.instant, .cal-track.instant * { transition: none !important; }
.cal-pane { position: absolute; top: 0; left: 0; width: 100%; padding: 0 4px; will-change: transform; }
.cal-shift { transition: transform .42s var(--ease); }
.slide-left-enter-active, .slide-left-leave-active, .slide-right-enter-active, .slide-right-leave-active { transition: transform .4s var(--ease), opacity .3s var(--ease); }
.slide-left-enter-from { transform: translateX(40%); opacity: 0; }
.slide-left-leave-to { transform: translateX(-40%); opacity: 0; }
.slide-right-enter-from { transform: translateX(-40%); opacity: 0; }
.slide-right-leave-to { transform: translateX(40%); opacity: 0; }
.cal-handle {
  flex: none; position: relative; z-index: 2; display: grid; place-items: center; width: 100%; height: 22px;
  background: var(--surface); border-radius: 0 0 var(--r-xl) var(--r-xl); box-shadow: 0 6px 12px -8px rgba(16, 24, 40, .16);
  will-change: transform; transition: transform .42s var(--ease);
}
.cal-handle i { width: 34px; height: 5px; border-radius: 3px; background: var(--fill-2); transition: width .3s var(--ease); }
.cal-handle i.week { width: 22px; }

/* ---- 日程 ---- */
.agenda {
  flex: 1; min-height: 0; position: relative; z-index: 1; padding: 30px 16px 0; margin-top: -16px;
  background: var(--bg); will-change: transform; transition: transform .42s var(--ease);
}
.agenda-head { display: flex; align-items: center; gap: 12px; padding: 0 4px 14px; }
.ah-text { flex: 1; min-width: 0; }
.ah-text h2 { margin: 0; font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.ah-text p { margin: 2px 0 0; font-size: 13px; color: var(--text-3); }
.ah-tag { font-size: 11.5px; font-weight: 600; padding: 2px 7px; border-radius: 6px; background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
.ah-tag.work { background: var(--fill); color: var(--text-2); }
.ring { position: relative; width: 44px; height: 44px; flex: none; }
.ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring circle { fill: none; stroke-width: 3.2; }
.ring-bg { stroke: var(--fill-2); }
.ring-fg { stroke: var(--accent); stroke-linecap: round; stroke-dasharray: 94.25; transition: stroke-dashoffset .6s var(--ease); }
.ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11px; font-weight: 600; color: var(--text-2); }

.group { margin-bottom: 18px; }
.group-head { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 4px 8px; font-size: 13px; font-weight: 600; color: var(--text-3); }
.group-head.danger { color: var(--danger); }
.group-head .icon { width: 16px; height: 16px; transition: transform .3s var(--ease); }
.group-head .icon.up { transform: rotate(180deg); }
.link { font-size: 13px; font-weight: 600; color: var(--accent); }
.tlist { position: relative; display: flex; flex-direction: column; gap: 8px; }

.empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12px 24px 0; }
.empty b { font-size: 16px; font-weight: 600; margin-top: 4px; }
.empty p { font-size: 13px; color: var(--text-3); margin: 6px 0 16px; }
.empty-btn { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 18px; border-radius: 99px; background: var(--accent-soft); color: var(--accent); font-weight: 600; font-size: 14.5px; }
.empty-btn .icon { width: 18px; height: 18px; stroke-width: 2.2; }
.agenda-pad { height: 110px; }

.fab {
  position: absolute; right: 20px; bottom: 20px; z-index: 5; width: 58px; height: 58px; border-radius: 20px;
  display: grid; place-items: center; background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow-fab);
  transition: transform .25s var(--spring);
}
.fab .icon { width: 28px; height: 28px; stroke-width: 2.3; transition: transform .3s var(--ease); }
.fab:active { transform: scale(.9); }
.fab:active .icon { transform: rotate(90deg); }
</style>
