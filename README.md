# 每日计划 (planner)

A lightweight Android daily planner: calendar (with lunar calendar & Chinese public holidays) + Eisenhower matrix.
Vue 3 + Vite, packaged as an Android app with Capacitor 8.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173 — use a phone-sized viewport
```

## Build & install on phone

```bash
npm run apk          # vite build → cap sync → gradle assembleDebug
npm run install-apk  # adb install to the USB-connected phone
```

Requires JDK 21 and an Android SDK (`android/local.properties` points at `~/Library/Android/sdk`).

## Layout

| Path | Purpose |
|---|---|
| `src/lib/storage.js` | The only place that knows where data lives (Capacitor Preferences → Android SharedPreferences; localStorage in the browser). |
| `src/lib/store.js` | Reactive task list + settings; debounced save of the whole JSON after any change. |
| `src/lib/parse.js` | Chinese natural-language date/time parsing for quick add (`明天下午3点开会`, `每周五晚上8点 羽毛球`). |
| `src/lib/repeat.js` | Repeating tasks (daily / weekdays / weekly / monthly): one task + a rule, expanded per day; per-day `doneDates` / `skipDates`. |
| `src/lib/date.js` | Date helpers, lunar date / solar terms / festivals / 休·班 via `lunar-javascript`. |
| `src/lib/ui.js` | Haptics, toast with undo, Android back-button stack, keyboard height (`@capacitor/keyboard` `keyboardWillShow`). |
| `src/views/CalendarView.vue` | Month ⇄ week collapsible calendar (transform-only animation, three persistent pages for finger-following swipes), agenda with overdue / done groups. |
| `src/views/QuadrantView.vue` | 2×2 matrix with range filter and long-press drag between quadrants. |
| `src/views/MeView.vue` | Stats, display settings, backup export / import. |
| `src/components/TaskRow.vue` | Task row: animated check, swipe right to complete, swipe left for postpone / delete. |
| `src/components/QuickAdd.vue`, `TaskDetail.vue` | Bottom sheets for creating and editing tasks (edits save live). |
| `android/app/src/main/res/drawable/ic_launcher_*.xml` | Vector adaptive app icon (incl. Android 13 themed icon). |

## Android notes

- `MainActivity` enables edge-to-edge; safe areas come from native `env(safe-area-inset-*)` (WebView ≥ 140), so `SystemBars.insetsHandling` is `disable` in `capacitor.config.json`.
- With insets handling disabled the WebView is not resized when the keyboard opens; bottom sheets move up by the keyboard height instead.

## Data

Task shape: `{ id, title, note, date: 'YYYY-MM-DD' | '', time: 'HH:MM' | '', important, urgent, done, createdAt, doneAt, repeat, doneDates, skipDates }`.
Data lives in app-private storage and is wiped on uninstall — export a backup regularly.
