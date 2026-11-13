// Planner sync server: one JSON file behind a token. No dependencies (Node 18+).
//
//   PLANNER_TOKEN=... node planner-server.mjs
//
// Env:
//   PLANNER_TOKEN  required. Clients send it as "Authorization: Bearer <token>".
//   PORT           default 18787
//   HOST           default 0.0.0.0
//   DATA_FILE      default ./planner-data.json
//
// API (all JSON, all need the token except /health):
//   GET  /health          → { ok: true }
//   GET  /api/state       → { tasks, deleted, meta, rev }
//   POST /api/sync        body { tasks, deleted, meta? } → merged state (same shape as /api/state)
//   GET  /api/wait?rev=N  long poll: answers { rev } as soon as the data is newer than rev,
//                         or after ~25 s with the same rev. The app uses it to update instantly.
//
// The server only stores and merges (shared/merge.js). All task logic (repeat rules,
// "today", natural-language input) lives in the app and the agent CLI.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { mergeState } from '../shared/merge.js';

const TOKEN = process.env.PLANNER_TOKEN;
const PORT = Number(process.env.PORT) || 18787;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = path.resolve(process.env.DATA_FILE || 'planner-data.json');
const MAX_BODY = 20 * 1024 * 1024;

if (!TOKEN || TOKEN.length < 16) {
  console.error('Set PLANNER_TOKEN (at least 16 characters), e.g. PLANNER_TOKEN=$(openssl rand -hex 24)');
  process.exit(1);
}

let state = { tasks: [], deleted: {}, meta: {}, rev: 0 };
try {
  state = { ...state, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.error(`Cannot read ${DATA_FILE}:`, e.message);
    process.exit(1);
  }
}

function persist() {
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DATA_FILE); // atomic replace: a crash never leaves a half-written file
}

const tokenOk = (req) => {
  const got = Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(TOKEN);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
};

function send(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('body too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

const valid = (b) =>
  b && Array.isArray(b.tasks) && b.tasks.every((t) => t && typeof t.id === 'string') &&
  (b.deleted == null || typeof b.deleted === 'object');

// Long-poll clients waiting for the next change
const WAIT_MS = 25000;
const waiters = new Set();
const wake = () => [...waiters].forEach((w) => w());

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (url.pathname === '/health') return send(res, 200, { ok: true });
    if (!tokenOk(req)) return send(res, 401, { error: 'unauthorized' });

    if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, state);

    if (req.method === 'POST' && url.pathname === '/api/sync') {
      const body = await readBody(req);
      if (!valid(body)) return send(res, 400, { error: 'expected { tasks: [...], deleted: {...} }' });
      const merged = mergeState(state, body);
      const changed = JSON.stringify(merged) !== JSON.stringify({ tasks: state.tasks, deleted: state.deleted, meta: state.meta });
      if (changed) {
        state = { ...merged, rev: state.rev + 1 };
        persist();
        wake();
      }
      return send(res, 200, state);
    }

    if (req.method === 'GET' && url.pathname === '/api/wait') {
      const since = Number(url.searchParams.get('rev'));
      if (state.rev !== since) return send(res, 200, { rev: state.rev });
      const waiter = () => {
        clearTimeout(timer);
        waiters.delete(waiter);
        if (!res.writableEnded) send(res, 200, { rev: state.rev });
      };
      const timer = setTimeout(waiter, WAIT_MS);
      waiters.add(waiter);
      req.on('close', () => {
        clearTimeout(timer);
        waiters.delete(waiter);
      });
      return;
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`planner sync server on http://${HOST}:${PORT}, data: ${DATA_FILE}`);
  // Connection codes for the app (我的 → 同步) and for `planner login`.
  // Behind a reverse proxy with HTTPS, use https://your.domain#<token> instead.
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal);
  console.log('Connection code(s):');
  for (const i of ips) console.log(`  http://${i.address}:${PORT}#${TOKEN}`);
});
