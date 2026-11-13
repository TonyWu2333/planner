<script setup>
// 搜索：按标题和备注搜，空格分开的多个词要同时命中
import { ref, computed, watch, nextTick } from 'vue';
import Sheet from './Sheet.vue';
import Icon from './Icon.vue';
import { state, findTask } from '../lib/store.js';
import { dateLabel } from '../lib/date.js';
import { repeatLabel } from '../lib/repeat.js';
import { quadrantOf, byDate, isOverdue } from '../lib/quadrant.js';
import { keyboard } from '../lib/ui.js';
import { $t } from '../lib/i18n.js';

const props = defineProps({ open: Boolean });
const emit = defineEmits(['close', 'open']);

const q = ref('');
const input = ref(null);
watch(
  () => props.open,
  (v) => {
    if (!v) return;
    q.value = '';
    nextTick(() => input.value?.focus({ preventScroll: true }));
  },
);

const terms = computed(() => q.value.trim().toLowerCase().split(/\s+/).filter(Boolean));
const results = computed(() => {
  if (!terms.value.length) return { open: [], done: [] };
  const hit = state.tasks.filter((t) => {
    const hay = `${t.title}\n${t.note}`.toLowerCase();
    return terms.value.every((w) => hay.includes(w));
  });
  return {
    open: hit.filter((t) => t.repeat || !t.done).sort(byDate),
    done: hit.filter((t) => !t.repeat && t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
  };
});
const total = computed(() => results.value.open.length + results.value.done.length);

// 把文字切成 [{ text, hit }]，命中的部分高亮（不用 v-html）
function marks(text) {
  if (!terms.value.length) return [{ text, hit: false }];
  const re = new RegExp(`(${terms.value.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  // split 带捕获组：奇数位就是命中的部分
  return text.split(re).map((part, i) => ({ text: part, hit: i % 2 === 1 })).filter((m) => m.text);
}
// 备注里命中的那一段（前后留几个字）
function noteSnippet(t) {
  const note = t.note.replace(/\s+/g, ' ');
  const lower = note.toLowerCase();
  const i = Math.min(...terms.value.map((w) => lower.indexOf(w)).filter((x) => x >= 0));
  if (!Number.isFinite(i)) return '';
  const start = Math.max(0, i - 8);
  return (start ? '…' : '') + note.slice(start, start + 40);
}
const sub = (t) =>
  [
    t.dropped && $t('已放弃'),
    t.repeat ? repeatLabel(t.repeat, t.date) : t.date ? dateLabel(t.date) : $t('无日期'),
    t.time,
    t.parentId && `↳ ${findTask(t.parentId)?.title ?? ''}`,
  ].filter(Boolean).join(' · ');

function pick(t) {
  input.value?.blur();
  emit('open', t.id);
}
</script>

<template>
  <Sheet :open="open" max-height="88dvh" @close="emit('close')">
    <div class="ss" :style="{ '--kb': keyboard.cover + 'px' }">
      <div class="ss-bar">
        <Icon name="search" />
        <input
          ref="input"
          v-model="q"
          type="search"
          :placeholder="$t('搜索任务、子任务、备注')"
          enterkeyhint="search"
          @keydown.enter="input?.blur()"
        />
        <button v-if="q" class="ss-clear" :aria-label="$t('清空')" @click="q = ''; input?.focus()"><Icon name="x" /></button>
      </div>

      <div class="ss-body scroll">
        <div v-if="!terms.length" class="ss-hint">
          <Icon name="search" />
          <p>{{ $t('输入关键词，搜索全部任务的标题、子任务和备注') }}<br />{{ $t('多个词用空格分开') }}</p>
        </div>
        <div v-else-if="!total" class="ss-hint">
          <p>{{ $t('没有找到包含「{q}」的任务', { q: q.trim() }) }}</p>
        </div>
        <template v-else>
          <template v-for="[key, label] in [['open', $t('待办')], ['done', $t('已完成')]]" :key="key">
            <template v-if="results[key].length">
              <div class="ss-group">{{ label }} · {{ results[key].length }}</div>
              <button v-for="t in results[key]" :key="t.id" class="sr" :class="['q' + quadrantOf(t), { done: key === 'done' }]" @click="pick(t)">
                <i class="sr-dot" />
                <span class="sr-main">
                  <span class="sr-title"><template v-for="(m, i) in marks(t.title)" :key="i"><mark v-if="m.hit">{{ m.text }}</mark><template v-else>{{ m.text }}</template></template></span>
                  <span class="sr-sub">
                    <span :class="{ overdue: key === 'open' && isOverdue(t) }">{{ sub(t) }}</span>
                    <span v-if="noteSnippet(t)" class="sr-note">
                      <template v-for="(m, i) in marks(noteSnippet(t))" :key="i"><mark v-if="m.hit">{{ m.text }}</mark><template v-else>{{ m.text }}</template></template>
                    </span>
                  </span>
                </span>
                <Icon name="chevron-right" class="sr-arrow" />
              </button>
            </template>
          </template>
        </template>
      </div>
    </div>
  </Sheet>
</template>

<style>
.ss { display: flex; flex-direction: column; height: calc(88dvh - 22px - var(--kb, 0px)); padding: 0 16px; }
.ss-bar { flex: none; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 6px 0 12px; border-radius: 14px; background: var(--surface-2); }
.ss-bar > .icon { width: 18px; height: 18px; color: var(--text-3); flex: none; }
.ss-bar input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 16px; caret-color: var(--accent); }
.ss-bar input::-webkit-search-cancel-button { display: none; }
.ss-bar input::placeholder { color: var(--text-3); }
.ss-clear { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: var(--text-3); }
.ss-clear .icon { width: 16px; height: 16px; }
.ss-body { flex: 1; min-height: 0; padding: 8px 0 16px; }
.ss-hint { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 48px; text-align: center; color: var(--text-3); font-size: 13.5px; line-height: 1.6; }
.ss-hint .icon { width: 36px; height: 36px; stroke-width: 1.5; opacity: .5; }
.ss-hint p { margin: 0; }
.ss-group { font-size: 13px; font-weight: 600; color: var(--text-3); padding: 10px 4px 6px; }
.sr { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 6px 11px 4px; text-align: left; border-radius: 12px; }
.sr + .sr { border-top: 1px solid var(--sep); }
.sr:active { background: var(--fill); }
.sr-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--qc); }
.sr.done .sr-dot { background: var(--text-3); border-color: var(--text-3); }
.sr-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sr-title { font-size: 15.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sr.done .sr-title { color: var(--text-3); text-decoration: line-through; }
.sr-sub { display: flex; gap: 8px; font-size: 12.5px; color: var(--text-3); white-space: nowrap; overflow: hidden; }
.sr-sub .overdue { color: var(--danger); }
.sr-note { overflow: hidden; text-overflow: ellipsis; }
.sr mark { background: color-mix(in srgb, var(--accent) 18%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }
.sr-arrow { flex: none; width: 16px; height: 16px; color: var(--text-3); }
</style>
