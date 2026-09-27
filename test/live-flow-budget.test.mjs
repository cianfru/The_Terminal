// The live whale pulse on a free Alchemy plan: one shared copy, one refresher at a time, a monthly budget.
import { test } from "node:test";
import assert from "node:assert/strict";

const db = new Map();
function redis(a) {
  const [c, k, ...r] = a.map(String);
  switch (c.toUpperCase()) {
    case "GET": return db.has(k) ? db.get(k) : null;
    case "SET": { const nx = r.includes("NX"); if (nx && db.has(k)) return null; db.set(k, r[0]); return "OK"; }
    case "INCRBY": { const v = Number(db.get(k) || 0) + Number(r[0]); db.set(k, String(v)); return v; }
    case "EXPIRE": return 1;
    case "DEL": return db.delete(k) ? 1 : 0;
    default: throw new Error("unhandled " + c);
  }
}
let alchemyCalls = 0, alchemyDown = false;
process.env.KV_REST_API_URL = "https://kv.test"; process.env.KV_REST_API_TOKEN = "t"; process.env.ALCHEMY_KEY = "k";
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.host === "kv.test") {
    if (u.pathname === "/pipeline") return { ok: true, json: async () => JSON.parse(opts.body).map(x => ({ result: redis(x) })) };
    return { ok: true, json: async () => ({ result: redis(u.pathname.slice(1).split("/").map(decodeURIComponent)) }) };
  }
  alchemyCalls++;
  if (alchemyDown) return { ok: false, status: 429, json: async () => ({}) };
  const body = JSON.parse(opts.body);
  const one = b => {
    if (b.method === "eth_blockNumber") return { id: b.id, result: "0x100000" };
    if (b.method === "getSlot") return { id: b.id, result: 1e9 };
    if (b.method === "alchemy_getAssetTransfers") return { id: b.id, result: { transfers: [] } };
    return { id: b.id, error: { code: -32600, message: "archive needs a paid plan" } };   // Free plan: Solana skips itself
  };
  return { ok: true, json: async () => (Array.isArray(body) ? body.map(one) : one(body)) };
};
const { default: handler, liveFlowDecision, monthKey } = await import("../api/live-flow.js");
const call = async qs => {
  const res = { body: null, setHeader() {}, status() { return this; }, json(o) { this.body = o; return this; } };
  await handler({ url: "/api/live-flow" + (qs || "") }, res);
  return res.body;
};

test("the decision: fresh copy is served, a spent budget pauses, otherwise refresh", () => {
  const now = Date.parse("2026-09-27T12:00:00Z"), m = 60e3;
  assert.equal(liveFlowDecision({ cached: { updated: "2026-09-27T11:45:00Z" }, now, refreshMs: 30 * m, spent: 0, budget: 1 }), "serve");
  assert.equal(liveFlowDecision({ cached: { updated: "2026-09-27T11:00:00Z" }, now, refreshMs: 30 * m, spent: 10, budget: 10 }), "paused");
  assert.equal(liveFlowDecision({ cached: null, now, refreshMs: 30 * m, spent: 0, budget: 10 }), "pull");
  assert.equal(monthKey(new Date("2026-09-27T00:00:00Z")), "liveflow:cu:2026-09");
});

test("the first visitor pulls once; everyone after gets the shared copy without touching Alchemy", async () => {
  const a = await call();
  assert.equal(a.cache, "fresh"); assert.ok(alchemyCalls > 0); assert.ok(a.cu > 0);
  assert.ok(Number(db.get(monthKey())) >= a.cu, "the pull's cost is counted for the month");
  const before = alchemyCalls;
  for (let i = 0; i < 20; i++) assert.equal((await call("?days=14")).cache, "shared", "?days= can't force a pull");
  assert.equal(alchemyCalls, before, "20 more visitors, 0 more Alchemy calls");
});

test("a copy older than the refresh window: one refresher at a time; the rest get the last copy", async () => {
  const c = JSON.parse(db.get("liveflow:v1")); c.updated = new Date(Date.now() - 3600e3).toISOString(); db.set("liveflow:v1", JSON.stringify(c));
  db.set("liveflow:lock", "1");                                  // someone else is refreshing
  const before = alchemyCalls;
  assert.equal((await call()).cache, "stale"); assert.equal(alchemyCalls, before);
  db.delete("liveflow:lock");
});

test("past the monthly budget it stops pulling and keeps serving the last copy", async () => {
  db.set(monthKey(), String(10e6));
  const before = alchemyCalls, r = await call();
  assert.equal(r.cache, "stale"); assert.match(r.paused, /budget/); assert.equal(alchemyCalls, before);
  db.set(monthKey(), "0");
});

test("a pull that fails outright (e.g. the plan's cap) keeps serving the last good copy", async () => {
  alchemyDown = true;
  const r = await call();
  assert.equal(r.cache, "stale"); assert.ok(r.errors?.length); assert.equal(db.get("liveflow:lock"), undefined, "lock released");
  alchemyDown = false;
});
