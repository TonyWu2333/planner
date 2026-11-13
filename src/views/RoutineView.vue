<script setup>
// 打卡：所有重复任务集中在这里，按规则分组（每天 / 工作日 / 每周 / 每月）。
// 每条显示今天这一次（今天不发生就显示下一次），可以直接打勾，并显示连续完成了几次。
import { computed } from 'vue';
import Icon from '../components/Icon.vue';
import TaskRow from '../components/TaskRow.vue';
import EmptyArt from '../components/EmptyArt.vue';
import { state, toggleDone, removeTask, skipOccurrence, childrenOf } from '../lib/store.js';
import { today } from '../lib/date.js';
import { occursOn, nextOccurrence, instanceOf, streakOf, repeatGroup, parseRule } from '../lib/repeat.js';
import { toast } from '../lib/ui.js';
import { $t } from '../lib/i18n.js';

const emit = defineEmits(['open', 'add', 'search']);

const GROUPS = [
  ['daily', '每天'],
  ['interval', '每隔几天'],
  ['weekly', '每周'],
  ['monthly', '每月'],
  ['yearly', '每年'],
  ['ended', '已结束'],
];
// 连续完成的单位：每天 → 天，每周只有一天 → 周，每月 → 个月，其他按“次”
// 只给中文单位，TaskRow 会把"连续 {n} 天"整句翻译成英文
function unitOf(t) {
  const r = parseRule(t.repeat);
  let u = '次';
  if (repeatGroup(t.repeat) === 'daily') u = '天';
  else if (r.freq === 'w' && r.n === 1 && r.days.length === 1) u = '周';
  else if (r.freq === 'm' && r.n === 1) u = '个月';
  else if (r.freq === 'y' && r.n === 1) u = '年';
  return u;
}

const routines = computed(() => state.tasks.filter((t) => t.repeat && !t.parentId));

const todayList = computed(() => routines.value.filter((t) => occursOn(t, today())));
const doneToday = computed(() => todayList.value.filter((t) => t.doneDates.includes(today())).length);
const progress = computed(() => (todayList.value.length ? doneToday.value / todayList.value.length : 0));

const groups = computed(() => {
  const d0 = today();
  const all = routines.value.map((t) => {
    const occ = occursOn(t, d0) ? d0 : nextOccurrence(t, d0);
    const streak = streakOf(t, d0);
    return {
      task: occ ? instanceOf(t, occ) : { ...t, occ: '' },
      group: occ ? repeatGroup(t.repeat) : 'ended', // 过了结束日期、以后不会再发生
      isToday: occ === d0,
      streak,
      unit: unitOf(t),
    };
  });
  return GROUPS.map(([key, label]) => {
    const items = all
      .filter((it) => it.group === key)
      // 今天要做的在前，再按时间、创建先后
      .sort(
        (a, b) =>
          b.isToday - a.isToday ||
          (a.task.time || '99').localeCompare(b.task.time || '99') ||
          a.task.createdAt - b.task.createdAt,
      );
    return { key, label: $t(label), items };
  }).filter((g) => g.items.length);
});

function onDelete(t) {
  const kids = childrenOf(t.id).length;
  const undo = removeTask(t.id);
  toast(kids ? $t('已删除「{title}」及 {n} 个子任务', { title: t.title, n: kids }) : $t('已删除「{title}」', { title: t.title }), { action: undo });
}
function onSkip(t) {
  if (!t.occ) return;
  const undo = skipOccurrence(t.id, t.occ);
  toast($t(t.occ === today() ? '今天这次已跳过' : '下一次已跳过'), { action: undo });
}
</script>

<template>
  <div class="rtview">
  <div class="rt-scroll scroll">
    <header class="page-header">
      <h1>{{ $t('打卡') }}</h1>
      <button class="icon-btn rt-search press" :aria-label="$t('搜索')" @click="emit('search')"><Icon name="search" /></button>
    </header>

    <template v-if="routines.length">
      <section class="rt-summary">
        <div class="ring">
          <svg viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" class="ring-bg" />
            <circle cx="18" cy="18" r="15" class="ring-fg" :style="{ strokeDashoffset: 94.25 * (1 - progress) }" />
          </svg>
        </div>
        <div class="rt-sum-text">
          <b v-if="!todayList.length">{{ $t('今天没有要打卡的') }}</b>
          <b v-else-if="doneToday === todayList.length">{{ $t('今天的卡都打完了') }}</b>
          <b v-else>{{ $t('今天还剩 {n} 项', { n: todayList.length - doneToday }) }}</b>
          <span class="num">{{ $t('今天 {done}/{total} · 共 {n} 项打卡', { done: doneToday, total: todayList.length, n: routines.length }) }}</span>
        </div>
      </section>

      <section v-for="g in groups" :key="g.key" class="rt-group">
        <h2 class="rt-head">{{ g.label }}<span class="num">{{ g.items.length }}</span></h2>
        <div class="tlist">
          <TaskRow
            v-for="it in g.items"
            :key="it.task.id"
            :task="it.task"
            :class="{ later: !it.isToday }"
            :show-date="!it.isToday && !!it.task.occ"
            :hide-repeat="g.key === 'daily'"
            :streak="it.streak"
            :streak-unit="it.unit"
            @toggle="toggleDone(it.task.id, it.task.occ)"
            @open="emit('open', it.task.id, it.task.occ)"
            @delete="onDelete(it.task)"
            @postpone="onSkip(it.task)"
          />
        </div>
      </section>
    </template>

    <div v-else class="empty rt-empty">
      <EmptyArt />
      <b>{{ $t('还没有打卡任务') }}</b>
      <p>{{ $t('每天、每周都要做的事放在这里打卡') }}<br />{{ $t('试试输入「每天 跑步」或「每周五晚上8点 周会」') }}</p>
      <button class="empty-btn press" @click="emit('add', { repeat: 'd1' })"><Icon name="plus" />{{ $t('添加打卡') }}</button>
    </div>

    <div class="rt-pad" />
  </div>
    <button class="fab" :aria-label="$t('新建打卡')" @click="emit('add', { repeat: 'd1' })"><Icon name="plus" /></button>
  </div>
</template>

<style>
.rtview { position: relative; height: 100%; }
.rt-scroll { height: 100%; }
.rtview .page-header { align-items: center; }
.rt-search { width: 36px; height: 36px; background: var(--fill); }
.rt-search .icon { width: 18px; height: 18px; stroke-width: 2.1; }
.rt-summary {
  display: flex; align-items: center; gap: 14px; margin: 6px 16px 4px; padding: 14px 16px;
  background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1);
}
.rt-sum-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rt-sum-text b { font-size: 16px; font-weight: 650; }
.rt-sum-text span { font-size: 12.5px; color: var(--text-3); }
.rt-group { padding: 0 16px; }
.rt-head { display: flex; align-items: center; gap: 6px; margin: 18px 4px 8px; font-size: 14px; font-weight: 650; color: var(--text-2); }
.rt-head span { font-size: 12px; font-weight: 600; color: var(--text-3); }
.rtview .later .trow-title { color: var(--text-2); }
.rt-empty { padding-top: 48px; }
.rt-pad { height: 110px; }
</style>
