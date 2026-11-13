# 可及 Design Guidelines

可及 (Reach) is a family of small, sharp tool apps. Each app works on its own, keeps its data with the user, and can be driven by the user's own AI agents through a skill. These guidelines cover the whole family; the last section covers 可及清单, the first app.

> 触手可及：你够得着，你的 agent 也够得着。
> Within reach — for you, and for your agent.

Source of truth for values: `src/style.css` (tokens) and `scripts/gen-icons.py` (icon). This document explains them; when the two disagree, fix one of them.

## 1. Principles

1. **One thing, done well.** Each app owns one job. No feature that would make sense only as a menu item in another app.
2. **Quiet by default.** Neutral surfaces, one accent color, colour only where it carries meaning (quadrant, status, today).
3. **Fast to the thumb.** Primary actions sit in the bottom half. Common actions are one tap; destructive ones can always be undone.
4. **Agent-ready.** Every action a person can take has a command an agent can run, with the same words and the same result.
5. **Your data.** Works offline, syncs to a server the user controls, exports to plain JSON.

## 2. Naming

| Thing | Rule | Example |
|---|---|---|
| Series | 可及 / Reach | |
| App | 可及 + a short noun for what it holds | 可及清单, 可及收藏, 可及邮箱 |
| English app name | Reach + noun | Reach List |
| Android application id | `com.tonywu.reach.<noun>` for new apps | `com.tonywu.reach.mail` |
| Agent skill | `reach-<noun>` | `reach-list` |

可及清单 keeps its original application id `com.tonywu.planner`, and its skill is still called `planner`. Changing the application id would install a second app with empty data.

## 3. Mascot and brand mark

**The mascot** is a small, round lavender octopus (`#B7A6F6` body, `#3B2A9E` eyes). It appears on every 可及 app icon, always the same character, size and colour, peeking over the top-right edge of the app's object with two arms resting on it. It is the family signature: the object changes from app to app, the octopus doesn't. Keep it friendly and simple — two dot eyes, a small smile, short rounded arms; no long tentacles.

**The brand mark** is a 可 whose hook ends in an amber dot (`docs/brand/reach-mark.svg`, `reach-mark-dark.svg`; dot is Reach Amber `#FFB23E`, token `--reach`). It is used small, in the app (我的 footer) and in docs. Minimum size 16 px. Reach Amber is a brand colour, not a UI colour: never use it for buttons, links, warnings or status.

## 4. App icon

Every 可及 icon is a soft 3D illustration made the same way:

| Aspect | Rule |
|---|---|
| Material | Matte, inflated "clay" forms with large radii; no hard edges, no gloss, no texture |
| Light | One soft key light from the top left; a faint contact shadow under the object, tinted with the object's colour |
| Background | Plain near-white (`#FEFEFE`), no gradient, no frame |
| Object | The app's object, front-facing, slightly taller than wide, in the app's pastel colour with a lighter face and a darker rim |
| Mascot | The lavender octopus over the object's top-right corner, about a third of the object's width |
| Detail | At most three inner elements on the object (rows, lines, a symbol), so it still reads at 48 px |

Production (`scripts/gen-icons.py`): the source is a square PNG on `#FEFEFE` in `docs/brand/` (可及清单: `list-icon-source.png`). The script finds the illustration's bounding box and places it on the 108 dp adaptive foreground at 60 dp tall, so both rounded-square and circular masks keep a margin; the background layer is the same near-white. There is no monochrome layer (Android themed icons fall back to the full-colour icon). The status-bar icon is a flat white line glyph of the object (rounded square + check for 可及清单), because notification icons must be single-colour silhouettes.

![可及清单 icon](brand/list-icon-source.png)

### The family

| App | Object on the icon | App colour |
|---|---|---|
| 可及清单 | notepad with ring binding and a checklist | lavender / `#4B5CF0` UI accent |
| 可及收藏 | bookmark ribbon | amber `#F59E0B` |
| 可及邮箱 | envelope | sky `#0EA5E9` |
| 可及人脉 | contact card with a person | pink `#EC4899` |
| 可及协作 | board with two task cards and a double check | orange `#F97316` |
| 可及财务 | coin with ¥ | emerald `#10B981` |
| 可及 Skill | lightning bolt badge | violet `#8B5CF6` |
| 可及 API | `{ }` brace block | teal `#14B8A6` |
| 可及工作流 | two nodes joined by an elbow connector | blue `#3B82F6` |
| 可及智能体 | small robot head | fuchsia `#D946EF` |
| 可及工具箱 | toolbox / grid of tiles | slate `#64748B` |

## 5. Colour

### App colours

Each app's UI accent is its colour from the table above; the icon uses a pastel version of the same hue. 可及清单's UI accent:

| App | Light | Dark |
|---|---|---|
| 可及清单 | `#4B5CF0` indigo | `#7584FF` |

In the UI the app colour is `--accent`, with `--accent-soft` (≈10 % tint) for selected chips and highlighted rows, and `--on-accent` for text on it.

### Neutrals (shared by every app)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F3F4F6` | `#0C0D10` | page background |
| `--surface` | `#FFFFFF` | `#18191D` | cards, sheets |
| `--surface-2` | `#F6F7F9` | `#202126` | inputs, nested cards |
| `--fill` / `--fill-2` | grey 10 % / 17 % | grey 14 % / 22 % | chips, pressed states |
| `--text` | `#16171A` | `#ECEEF1` | primary text |
| `--text-2` | `#5D626C` | `#A3A8B2` | secondary text, icons |
| `--text-3` | `#A0A5AE` | `#676C76` | hints, disabled |
| `--sep` | 7 % black | 7 % white | hairlines |

### Semantic

`--danger` (delete, overdue), `--success` (done), `--warn` (needs attention). Use them for meaning only, never decoration. Light and dark values live in `src/style.css`.

### Dark mode

Every token has a dark value; components never hard-code colours. Dark surfaces get lighter as they come forward (`--bg` < `--surface` < `--surface-2`), and shadows become 1 px light outlines.

## 6. Typography

System font stack (`--font`): PingFang SC / HarmonyOS Sans SC / MiSans / Noto Sans SC. Numbers that line up (times, counts, dates in lists) use `.num` (tabular figures).

| Token | Size | Weight | Use |
|---|---|---|---|
| `--fs-title` | 30 | 750 | page title |
| `--fs-h2` | 20 | 650 | sheet title, section headline |
| `--fs-h3` | 17 | 600 | card title |
| `--fs-body` | 16 | 400 | task titles, inputs |
| `--fs-sub` | 14 | 400–600 | secondary lines, chips, buttons |
| `--fs-foot` | 13 | 400 | meta, group headers |
| `--fs-cap` | 12 | 500 | tags, badges, tab labels |
| `--fs-mini` | 11 | 500 | calendar sub-labels (农历, 节气) |

Weights in use: 400, 500, 600, 650, 700, 750. Do not go below 11 px. New code uses the tokens; older half-pixel sizes (12.5, 13.5, 14.5) are being moved to the nearest step.

## 7. Layout, shape, depth

- **Grid:** 4 px. Page gutter 20 px; card padding 14–16 px; list rows ≥ 52 px tall; touch targets ≥ 40 × 40 px.
- **Radius:** `--r-sm` 10 (inputs, small buttons) · `--r-md` 14 (cards, rows) · `--r-lg` 20 (large cards) · `--r-xl` 26 (sheet top) · pills 99.
- **Depth:** `--shadow-1` for resting cards, `--shadow-2` for floating panels, `--shadow-fab` (tinted with the accent) for the add button. One elevation per screen region; don't stack shadows.
- **Safe areas:** content runs edge to edge; headers start at `--head-top`, bottom bars add `--sab`.

## 8. Motion and feedback

| Token | Curve | Use |
|---|---|---|
| `--ease` | `cubic-bezier(.32,.72,0,1)` | sheets, pages, list moves |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | press feedback, small changes |
| `--spring` | `cubic-bezier(.34,1.56,.64,1)` | check marks, toggles (a little overshoot) |

- Durations: 180 ms press · 250–300 ms small change · 380–420 ms sheet / page.
- Every pressable thing scales to 0.96 (`.press`).
- Bottom sheets follow the keyboard frame by frame (`--kb-lift`, driven by the native IME animation); they never jump.
- Haptics: `light` for taps that change state, `select` for pickers, `success` for completing, `medium` for destructive confirmations.
- Anything destructive shows a toast with 撤销 for ~4 s instead of a confirmation dialog, unless it removes many items.

## 9. Components (shared patterns)

- **Tab bar:** at most 4 tabs, icon + 2-character label, accent on the active tab.
- **Page header:** large title (`--fs-title`) left, up to two 40 px icon buttons right.
- **List row:** leading check (24 px), title, one meta line; swipe left for actions (64 px each: 推迟, 放弃, 删除).
- **Bottom sheet:** the only modal surface. Drag handle, swipe down to close, tap outside to close, keyboard-aware.
- **Chip:** 32 px pill, `--fill` at rest, `--accent-soft` + accent text when on.
- **Empty state:** small illustration, one line saying what's missing, one action.

## 10. Writing

- Chinese UI, short and plain, the way a person would say it: 「今天的卡都打完了」, not 「您今日的例行任务已全部完成」.
- Prefer everyday words over product or AI jargon: 打卡 not 例行, 放弃 not 归档, 连接码 not 凭证.
- No exclamation marks, no emoji in UI text.
- Numbers: Arabic digits, 「3 项」 with a space, times as `14:00`, dates as 「11月20日 周五」.
- Errors say what happened and what to do: 「连不上服务器，回到同一个 Wi-Fi 再试」.

## 11. Agent integration

Every 可及 app ships the same three things so that any agent (Claude Code, Codex, Hermes, …) can use it:

1. **Sync:** the app syncs with the user's own server (`server/`), full-state merge by per-item `updatedAt`, with tombstones for deletes, and a long poll for live updates.
2. **CLI:** a single-file Node script with plain-text output (one item per line, `#id` at the end) and `--json` on every read command.
3. **Skill:** `SKILL.md` with a description that names the app in Chinese and English and lists the user's likely phrasings.

Commands use the same verbs as the UI (`done`, `skip`, `drop`, `restore`) and accept the same natural-language input the app's add box accepts. One connection code (`url#token`) connects both the phone and the agent.
