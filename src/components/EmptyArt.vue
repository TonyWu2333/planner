<template>
  <!-- 空状态插画：一张日历卡片 + 勾 + 星光 -->
  <svg class="empty-art" viewBox="0 0 160 120" aria-hidden="true">
    <ellipse cx="80" cy="108" rx="46" ry="6" fill="var(--fill)" />
    <rect x="38" y="22" width="84" height="78" rx="16" fill="var(--surface)" stroke="var(--fill-2)" stroke-width="2" />
    <path d="M38 38a16 16 0 0 1 16-16h52a16 16 0 0 1 16 16v6H38z" fill="var(--accent)" opacity=".9" />
    <rect x="58" y="14" width="6" height="16" rx="3" fill="var(--text-3)" />
    <rect x="96" y="14" width="6" height="16" rx="3" fill="var(--text-3)" />
    <circle cx="80" cy="70" r="17" fill="var(--accent-soft)" />
    <path d="M71.5 70.5l6 6 11-12" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M132 30l2.4 6.2 6.2 2.4-6.2 2.4-2.4 6.2-2.4-6.2-6.2-2.4 6.2-2.4z" fill="var(--q2)" />
    <path d="M26 58l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="var(--q3)" />
    <circle cx="138" cy="72" r="3" fill="var(--q4)" />
    <circle cx="22" cy="34" r="2.5" fill="var(--q1)" />
  </svg>
</template>

<style>
.empty-art { width: 150px; height: auto; }
</style>
