<script setup>
// 例行：所有重复任务集中在这里，按规则分组（每天 / 工作日 / 每周 / 每月）。
// 每条显示今天这一次（今天不发生就显示下一次），可以直接打勾，并显示连续完成了几次。
import { computed } from 'vue';
import Icon from '../components/Icon.vue';
import TaskRow from '../components/TaskRow.vue';
import EmptyArt from '../components/EmptyArt.vue';
import { state, toggleDone, removeTask, skipOccurrence, childrenOf } from '../lib/store.js';
import { today } from '../lib/date.js';
import { REPEATS, occursOn, nextOccurrence, instanceOf, streakOf } from '../lib/repeat.js';
import { toast } from '../lib/ui.js';

const emit = defineEmits(['open', 'add', 'search']);

const GROUP = { daily: '每天', weekdays: '工作日', weekly: '每周', monthly: '每月' };
const UNIT = { daily: '天', weekdays: '天', weekly: '周', monthly: '个月' };

const routines = computed(() => state.tasks.filter((t) => t.repeat && !t.parentId));

const todayList = computed(() => routines.value.filter((t) => occursOn(t, today())));
const doneToday = computed(() => todayList.value.filter((t) => t.doneDates.includes(today())).length);
const progress = computed(() => (todayList.value.length ? doneToday.value / todayList.value.length : 0));

const groups = computed(() => {
  const d0 = today();
  return REPEATS.map((r) => {
    const items = routines.value
      .filter((t) => t.repeat === r)
      .map((t) => {
        const occ = occursOn(t, d0) ? d0 : nextOccurrence(t, d0);
        return { task: occ ? instanceOf(t, occ) : { ...t, occ: '' }, isToday: occ === d0, streak: streakOf(t, d0) };
      })
      // 今天要做的在前，再按时间、创建先后
      .sort(
        (a, b) =>
          b.isToday - a.isToday ||
          (a.task.time || '99').localeCompare(b.task.time || '99') ||
          a.task.createdAt - b.task.createdAt,
      );
    return { key: r, label: GROUP[r], unit: UNIT[r], items };
  }).filter((g) => g.items.length);
});

function onDelete(t) {
  const kids = childrenOf(t.id).length;
  const undo = removeTask(t.id);
  toast(kids ? `已删除「${t.title}」及 ${kids} 个子任务` : `已删除「${t.title}」`, { action: undo });
}
function onSkip(t) {
  if (!t.occ) return;
  const undo = skipOccurrence(t.id, t.occ);
  toast(t.occ === today() ? '今天这次已跳过' : '下一次已跳过', { action: undo });
}
</script>

<template>
  <div class="rtview">
  <div class="rt-scroll scroll">
    <header class="page-header">
      <h1>例行</h1>
      <button class="icon-btn rt-search press" aria-label="搜索" @click="emit('search')"><Icon name="search" /></button>
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
          <b v-if="!todayList.length">今天没有例行</b>
          <b v-else-if="doneToday === todayList.length">今天的例行都完成了</b>
          <b v-else>今天还剩 {{ todayList.length - doneToday }} 项</b>
          <span class="num">今天 {{ doneToday }}/{{ todayList.length }} · 共 {{ routines.length }} 项例行</span>
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
            :show-date="!it.isToday"
            :hide-repeat="g.key === 'daily' || g.key === 'weekdays'"
            :streak="it.streak"
            :streak-unit="g.unit"
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
      <b>还没有例行任务</b>
      <p>每天、每周都要做的事放在这里打卡<br />试试输入「每天 跑步」或「每周五晚上8点 周会」</p>
      <button class="empty-btn press" @click="emit('add', { repeat: 'daily' })"><Icon name="plus" />添加例行</button>
    </div>

    <div class="rt-pad" />
  </div>
    <button class="fab" aria-label="新建例行" @click="emit('add', { repeat: 'daily' })"><Icon name="plus" /></button>
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
