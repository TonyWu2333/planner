---
name: planner
description: Read and manage the user's tasks in their 可及清单 (Reach List, formerly 每日计划) to-do and calendar phone app — today's agenda, overdue items, repeating check-ins (打卡), quadrants, subtasks. Use when the user asks what they have to do, wants to add, reschedule, complete, skip, drop or delete a task or reminder, or asks to plan their day or week, in Chinese or English.
---

# 可及清单 (planner)

The user keeps their tasks in a phone app. It syncs with a small server; the `planner` CLI in this skill reads and writes the same data, and the phone shows changes within a second or two while the app is open (otherwise the next time it is opened).

Run it with Node 18+:

```bash
node <skill-dir>/scripts/planner.mjs <command> [options]
```

`<skill-dir>` is the directory this file is in. Add `--json` to any read command when you need structured data.

## First run

If a command says "Not connected", ask the user for the connection code (shown in the sync server's log as `http://host:port#token`, and in the app under 我的 → 同步与 Agent), then run `planner login '<code>'`. Never print the token back in chat.

## Commands

| Goal | Command |
|---|---|
| What's on today (incl. overdue) | `planner today` |
| A day / range / week | `planner list --date 明天`, `planner list --from 2026-11-16 --to 2026-11-22`, `planner list --week` |
| Overdue, or tasks without a date | `planner list --overdue`, `planner list --undated` |
| Find a task | `planner search 周报` |
| Details and subtasks | `planner show <id>` |
| Add | `planner add 明天下午3点 开会` · `planner add 每周一三五 健身 --time 07:30` · `planner add 写方案 --quadrant 2 --note "..."` · `planner add 做PPT --parent <id>` |
| Complete / undo | `planner done <id>` · `planner undone <id>` (repeating task: `--date D`, default today or the next occurrence) |
| Skip one day of a repeating task | `planner skip <id> [--date D]` |
| Give up on a one-off task, keep it as a record | `planner drop <id>` · `planner restore <id>` |
| Change | `planner edit <id> --date 周五 --time 14:00` · `--repeat 工作日` · `--repeat ""` (stop repeating) · `--repeat "~2026-12-31"` (end date) · `--quadrant 1` · `--title` · `--note` · `--remind 15` |
| Delete (with subtasks) | `planner delete <id>` |

Ids appear as `#a1b2c3d4`; any unique prefix works. Dates accept `YYYY-MM-DD` or Chinese words (今天, 明天, 周五, 下周一, 11月20日); times accept `HH:MM` or 下午3点. "Today" follows the phone's timezone, not the machine you run on.

Output line format: `[ ] 14:00 Title  (象限 · 重复规则 · 日期 · ↳ 父任务 · 子任务 n/m)  #id` with `[✓]` done, `[x]` dropped.

## How to behave

- Read before you write: run `planner today` or `planner search` to get the right id instead of guessing.
- Pass Chinese time expressions straight into `add`; the CLI parses dates, times and repeat rules ("每周五晚上8点 羽毛球") the same way the app does. Check the echoed line to confirm it parsed as intended; fix with `edit` if not.
- Quadrants: 1 重要且紧急, 2 重要不紧急, 3 紧急不重要, 4 不重要不紧急 (default). Choose one only when the user's words make importance or urgency clear.
- Prefer `drop` or `skip` over `delete` when the user just doesn't want to do something; ask before deleting, and before changing many tasks at once.
- Repeating tasks (打卡) are completed per day: `done <id>` marks today's occurrence, not the whole series.
- Subtasks are one level deep and cannot repeat.
- After changing anything, tell the user briefly what changed (title, day, time), not the raw command.

## Server

The sync server is `server/planner-server.mjs` in this skill (single file, no dependencies):

```bash
PLANNER_TOKEN=$(openssl rand -hex 24) PORT=18787 DATA_FILE=~/planner-data.json node server/planner-server.mjs
```

It prints the connection code(s) on start. Put it behind HTTPS (e.g. Caddy or nginx) if it is reachable from the internet.
