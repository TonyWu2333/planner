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
npm run release          # signed release APK → android/app/build/outputs/apk/release/
npm run install-release  # adb install to the connected phone
npm run apk              # debug APK (debuggable WebView, for profiling via chrome://inspect)
```

Bump `version` in `package.json` before each release — it is the only place: Android's `versionName` is that string and
`versionCode` is derived from it (`major*10000 + minor*100 + patch`, e.g. 0.4.1 → 401), so every release installs over the
previous one and keeps its data. The app's "我的" page shows the same version.

Release signing reads `~/.android-keys/planner-release.properties` (override with `PLANNER_SIGNING=/path`),
which points at the keystore and holds its passwords. Neither is in the repo — back that folder up:
without the same key, a new build can't be installed over the old one.

Requires JDK 21 and an Android SDK (`android/local.properties` points at `~/Library/Android/sdk`).

## Layout

| Path | Purpose |
|---|---|
| `src/lib/storage.js` | The only place that knows where data lives (Capacitor Preferences → Android SharedPreferences; localStorage in the browser). |
| `src/lib/store.js` | Reactive task list + settings; debounced save of the whole JSON after any change. |
| `src/lib/parse.js` | Chinese natural-language date/time parsing for quick add (`明天下午3点开会`, `每周五晚上8点 羽毛球`). |
| `src/lib/repeat.js` | Repeating tasks (daily / weekdays / weekly / monthly): one task + a rule, expanded per day; per-day `doneDates` / `skipDates`. |
| `src/lib/date.js` | Date helpers, lunar date / solar terms / festivals / 休·班 via `lunar-javascript`. |
| `src/lib/notify.js` | Local reminders: plans the next 30 days of notifications (incl. repeats) and re-syncs on every change; uses `USE_EXACT_ALARM`. |
| `src/lib/ui.js` | Haptics, toast with undo, Android back-button stack, keyboard height (`@capacitor/keyboard` `keyboardWillShow`). |
| `src/views/CalendarView.vue` | Month ⇄ week collapsible calendar (transform-only animation, three persistent pages for finger-following swipes), agenda with overdue / done groups. |
| `src/views/QuadrantView.vue` | 2×2 matrix with range filter and long-press drag between quadrants. |
| `src/views/MeView.vue` | Stats, display settings, backup export / import, sync settings. |
| `src/components/TaskRow.vue` | Task row: animated check, swipe right to complete, swipe left for postpone / delete. |
| `src/components/SearchSheet.vue` | Search over titles and notes (space-separated terms, all must match). |
| `src/components/QuickAdd.vue`, `TaskDetail.vue` | Bottom sheets for creating and editing tasks (edits save live). |
| `android/app/src/main/res/drawable/ic_launcher_*.xml` | Vector adaptive app icon (incl. Android 13 themed icon). |

## Agent access (sync server + skill)

Agents such as Claude Code, Codex or Hermes can read and change the same tasks through a small self-hosted sync server:

```
phone app  ⇄  sync server (your server or this Mac)  ⇄  `planner` CLI + SKILL.md used by the agent
```

| Path | Purpose |
|---|---|
| `shared/merge.js` | Merge rule shared by app, server and CLI: per task, newer `updatedAt` wins; tombstones in `deleted` win over older edits. |
| `server/server.js` | Sync server: one JSON file behind a bearer token, `GET /api/state`, `POST /api/sync`. Node 18+, no dependencies. |
| `agent/cli.js` | `planner` CLI (today / list / search / add / done / skip / drop / edit / delete). Reuses the app's parsing and repeat logic. |
| `skill/planner/` | The installable skill: `SKILL.md`, bundled `scripts/planner.mjs` and `server/planner-server.mjs`. Rebuild with `npm run build:agent`. |
| `src/lib/sync.js` | App side: syncs on launch, resume, 2 s after a local change, and every minute in the foreground. |

**Run the server** (on a machine both the phone and the agent can reach):

```bash
PLANNER_TOKEN=$(openssl rand -hex 24) PORT=18787 DATA_FILE=/var/lib/planner/data.json \
  node skill/planner/server/planner-server.mjs
```

It prints a connection code `http://host:18787#token`. On a public server, put it behind HTTPS (for example Caddy: `planner.example.com { reverse_proxy 127.0.0.1:18787 }`) and use `https://planner.example.com#token`; keep it running with systemd or pm2.

**Connect the phone:** 我的 → 同步与 Agent → turn on, paste the connection code.

**Give an agent the skill:** copy or symlink `skill/planner` into the agent's skills folder (for example `~/.claude/skills/planner` for Claude Code; Codex and Hermes read the same `SKILL.md` format from their own skills folders), then run `node <skill>/scripts/planner.mjs login '<code>'` once on that machine, or set `PLANNER_CODE`.

## Android notes

- `MainActivity` enables edge-to-edge; safe areas come from native `env(safe-area-inset-*)` (WebView ≥ 140), so `SystemBars.insetsHandling` is `disable` in `capacitor.config.json`.
- With insets handling disabled the WebView is not resized when the keyboard opens; bottom sheets move up by the keyboard height instead.

## Data

Task shape: `{ id, title, note, date: 'YYYY-MM-DD' | '', time: 'HH:MM' | '', important, urgent, done, dropped, createdAt, doneAt, updatedAt, repeat, doneDates, skipDates, remind, parentId }` (`remind`: minutes before, `null` = off; `repeat`: rule string, see `src/lib/repeat.js`).
Data lives in app-private storage and is wiped on uninstall — export a backup regularly, or turn on sync.
