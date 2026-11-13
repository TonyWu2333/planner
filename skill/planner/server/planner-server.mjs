import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
// shared/merge.js
const TOMBSTONE_TTL = 7776e6;
function taskSig(t) {
	const { updatedAt, ...rest } = t;
	return JSON.stringify(rest);
}
const newer = (x, y) => {
	const a = x.updatedAt || 0;
	const b = y.updatedAt || 0;
	return a !== b ? a > b : taskSig(x) > taskSig(y);
};
function mergeState(a, b, now = Date.now()) {
	const deleted = { ...a.deleted || {} };
	for (const [id, at] of Object.entries(b.deleted || {})) if (!(deleted[id] >= at)) deleted[id] = at;
	const byId = /* @__PURE__ */ new Map();
	const order = [];
	for (const t of [...a.tasks || [], ...b.tasks || []]) {
		const cur = byId.get(t.id);
		if (!cur) order.push(t.id);
		if (!cur || newer(t, cur)) byId.set(t.id, t);
	}
	const tasks = [];
	for (const id of order) {
		const t = byId.get(id);
		const gone = deleted[id];
		if (gone && gone >= (t.updatedAt || 0)) continue;
		if (gone) delete deleted[id];
		tasks.push(t);
	}
	const ids = new Set(tasks.map((t) => t.id));
	const kept = tasks.filter((t) => !t.parentId || ids.has(t.parentId));
	for (const [id, at] of Object.entries(deleted)) if (now - at > TOMBSTONE_TTL) delete deleted[id];
	return {
		tasks: kept,
		deleted,
		meta: {
			...a.meta || {},
			...b.meta || {}
		}
	};
}
// server/server.js
const TOKEN = process.env.PLANNER_TOKEN;
const PORT = Number(process.env.PORT) || 18787;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = path.resolve(process.env.DATA_FILE || "planner-data.json");
const MAX_BODY = 20971520;
if (!TOKEN || TOKEN.length < 16) {
	console.error("Set PLANNER_TOKEN (at least 16 characters), e.g. PLANNER_TOKEN=$(openssl rand -hex 24)");
	process.exit(1);
}
let state = {
	tasks: [],
	deleted: {},
	meta: {},
	rev: 0
};
try {
	state = {
		...state,
		...JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
	};
} catch (e) {
	if (e.code !== "ENOENT") {
		console.error(`Cannot read ${DATA_FILE}:`, e.message);
		process.exit(1);
	}
}
function persist() {
	const tmp = `${DATA_FILE}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(state));
	fs.renameSync(tmp, DATA_FILE);
}
const tokenOk = (req) => {
	const got = Buffer.from(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
	const want = Buffer.from(TOKEN);
	return got.length === want.length && crypto.timingSafeEqual(got, want);
};
function send(res, code, body) {
	const data = JSON.stringify(body);
	res.writeHead(code, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"access-control-allow-origin": "*",
		"access-control-allow-headers": "authorization, content-type",
		"access-control-allow-methods": "GET, POST, OPTIONS"
	});
	res.end(data);
}
function readBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on("data", (c) => {
			size += c.length;
			if (size > MAX_BODY) {
				reject(Object.assign(/* @__PURE__ */ new Error("body too large"), { status: 413 }));
				req.destroy();
			} else chunks.push(c);
		});
		req.on("end", () => {
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
			} catch {
				reject(Object.assign(/* @__PURE__ */ new Error("invalid JSON"), { status: 400 }));
			}
		});
		req.on("error", reject);
	});
}
const valid = (b) => b && Array.isArray(b.tasks) && b.tasks.every((t) => t && typeof t.id === "string") && (b.deleted == null || typeof b.deleted === "object");
const WAIT_MS = 25e3;
const waiters = /* @__PURE__ */ new Set();
const wake = () => [...waiters].forEach((w) => w());
http.createServer(async (req, res) => {
	const url = new URL(req.url, "http://x");
	try {
		if (req.method === "OPTIONS") return send(res, 204, {});
		if (url.pathname === "/health") return send(res, 200, { ok: true });
		if (!tokenOk(req)) return send(res, 401, { error: "unauthorized" });
		if (req.method === "GET" && url.pathname === "/api/state") return send(res, 200, state);
		if (req.method === "POST" && url.pathname === "/api/sync") {
			const body = await readBody(req);
			if (!valid(body)) return send(res, 400, { error: "expected { tasks: [...], deleted: {...} }" });
			const merged = mergeState(state, body);
			if (JSON.stringify(merged) !== JSON.stringify({
				tasks: state.tasks,
				deleted: state.deleted,
				meta: state.meta
			})) {
				state = {
					...merged,
					rev: state.rev + 1
				};
				persist();
				wake();
			}
			return send(res, 200, state);
		}
		if (req.method === "GET" && url.pathname === "/api/wait") {
			const since = Number(url.searchParams.get("rev"));
			if (state.rev !== since) return send(res, 200, { rev: state.rev });
			const waiter = () => {
				clearTimeout(timer);
				waiters.delete(waiter);
				if (!res.writableEnded) send(res, 200, { rev: state.rev });
			};
			const timer = setTimeout(waiter, WAIT_MS);
			waiters.add(waiter);
			req.on("close", () => {
				clearTimeout(timer);
				waiters.delete(waiter);
			});
			return;
		}
		send(res, 404, { error: "not found" });
	} catch (e) {
		send(res, e.status || 500, { error: e.message });
	}
}).listen(PORT, HOST, () => {
	console.log(`planner sync server on http://${HOST}:${PORT}, data: ${DATA_FILE}`);
	const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal);
	console.log("Connection code(s):");
	for (const i of ips) console.log(`  http://${i.address}:${PORT}#${TOKEN}`);
});
export {};
