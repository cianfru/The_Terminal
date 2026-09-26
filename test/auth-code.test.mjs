// Invite-code sign-in (no X), end to end against an in-memory stand-in for the KV REST store.
import { test } from "node:test";
import assert from "node:assert/strict";

const db = new Map(), lists = new Map(), sets = new Map();
function redis(cmdArr) {
  const [c, ...a] = cmdArr.map(String), k = a[0];
  switch (c.toUpperCase()) {
    case "GET": return db.has(k) ? db.get(k) : null;
    case "SET": db.set(k, a[1]); return "OK";
    case "INCR": { const v = Number(db.get(k) || 0) + 1; db.set(k, String(v)); return v; }
    case "EXPIRE": return 1;
    case "SADD": { const s = sets.get(k) || new Set(); s.add(a[1]); sets.set(k, s); return 1; }
    case "SMEMBERS": return [...(sets.get(k) || [])];
    case "LPUSH": { const l = lists.get(k) || []; l.unshift(a[1]); lists.set(k, l); return l.length; }
    case "LTRIM": { lists.set(k, (lists.get(k) || []).slice(Number(a[1]), Number(a[2]) + 1)); return "OK"; }
    case "LRANGE": return (lists.get(k) || []).slice(Number(a[1]), Number(a[2]) + 1);
    default: throw new Error("unhandled " + c);
  }
}
process.env.KV_REST_API_URL = "https://kv.test"; process.env.KV_REST_API_TOKEN = "t";
process.env.SESSION_SECRET = "s3cret"; process.env.CONTROL_PASSWORD = "owner-pw";
delete process.env.X_LOGIN;
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.pathname === "/pipeline") return { ok: true, json: async () => JSON.parse(opts.body).map(x => ({ result: redis(x) })) };
  return { ok: true, json: async () => ({ result: redis(u.pathname.slice(1).split("/").map(decodeURIComponent)) }) };
};
const { default: handler } = await import("../api/auth.js");

async function call(method, qs, { body, cookie, ip = "1.1.1.1" } = {}) {
  const headers = {}, res = { statusCode: 200, body: null, setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, getHeader: k => headers[k.toLowerCase()],
    status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; }, send(o) { this.body = o; return this; }, end() { return this; } };
  await handler({ method, url: "/api/auth?" + qs, body, headers: { cookie: cookie || "", "x-forwarded-for": ip, "x-vercel-ip-country": "IT" } }, res);
  return { status: res.statusCode, body: res.body, headers };
}
const cookieOf = r => [].concat(r.headers["set-cookie"] || []).map(c => c.split(";")[0]).find(c => c.startsWith("df_sess=")) || "";

test("X sign-in is off by default: the login link lands on the invite-code screen", async () => {
  const r = await call("GET", "action=login");
  assert.equal(r.status, 302); assert.equal(r.headers.location, "/deepfield?auth=xoff");
  const me = await call("GET", "action=me");
  assert.deepEqual(me.body, { loggedIn: false, xLogin: false });
});

test("the owner mints a code; the person signs in with it and is a member", async () => {
  assert.equal((await call("POST", "action=invite", { body: { pw: "wrong", label: "Marco" } })).status, 403);
  const mint = await call("POST", "action=invite", { body: { pw: "owner-pw", label: "  Marco <b>" } });
  assert.equal(mint.body.ok, true); assert.equal(mint.body.label, "Marco b");
  const code = mint.body.code;
  const r = await call("POST", "action=code", { body: { code: " " + code.toLowerCase() + " " } });
  assert.equal(r.body.ok, true); assert.equal(r.body.username, "Marco b");
  const me = await call("GET", "action=me", { cookie: cookieOf(r) });
  assert.equal(me.body.loggedIn, true); assert.equal(me.body.member, true); assert.equal(me.body.via, "code"); assert.equal(me.body.owner, false);
  const list = await call("POST", "action=invites", { body: { pw: "owner-pw" } });
  assert.equal(list.body.invites.length, 1); assert.equal(list.body.invites[0].used, true);
  const mem = await call("POST", "action=members", { body: { pw: "owner-pw" } });
  assert.equal(mem.body.members[0].username, "Marco b"); assert.equal(mem.body.members[0].via, "code"); assert.equal(mem.body.members[0].country, "IT");
});

test("a wrong code is refused and logged; guessing is rate-limited", async () => {
  const r = await call("POST", "action=code", { body: { code: "DF-AAAA-AAAA" }, ip: "9.9.9.9" });
  assert.equal(r.body.ok, false);
  let last; for (let i = 0; i < 15; i++) last = await call("POST", "action=code", { body: { code: "DF-BBBB-BBBB" }, ip: "9.9.9.9" });
  assert.equal(last.status, 429);
  const mem = await call("POST", "action=members", { body: { pw: "owner-pw" } });
  assert.ok(mem.body.fails.some(f => f.stage === "code-wrong")); assert.ok(mem.body.fails.some(f => f.stage === "code-ratelimit"));
  assert.ok(!JSON.stringify(mem.body.fails).includes("9.9.9.9"), "no raw IP stored");
});

test("an owner code gets owner access; revoking a code pauses its member", async () => {
  const own = await call("POST", "action=invite", { body: { pw: "owner-pw", label: "me", owner: true } });
  const so = await call("POST", "action=code", { body: { code: own.body.code }, ip: "2.2.2.2" });
  assert.equal((await call("GET", "action=me", { cookie: cookieOf(so) })).body.owner, true);

  const m = await call("POST", "action=invite", { body: { pw: "owner-pw", label: "Temp" } });
  const s = await call("POST", "action=code", { body: { code: m.body.code }, ip: "3.3.3.3" });
  const h = (await call("POST", "action=invites", { body: { pw: "owner-pw" } })).body.invites.find(i => i.label === "Temp").h;
  assert.equal((await call("POST", "action=revoke", { body: { pw: "owner-pw", h } })).body.ok, true);
  assert.equal((await call("GET", "action=me", { cookie: cookieOf(s) })).body.member, false, "revoked → paused");
  assert.equal((await call("POST", "action=code", { body: { code: m.body.code }, ip: "4.4.4.4" })).body.ok, false, "code no longer works");
});

test("a returning member's visit is counted, at most once per 30 minutes", async () => {
  const m = await call("POST", "action=invite", { body: { pw: "owner-pw", label: "Visitor" } });
  const s = await call("POST", "action=code", { body: { code: m.body.code }, ip: "5.5.5.5" });
  const uid = [...db.keys()].find(k => k.startsWith("auth:user:c_") && JSON.parse(db.get(k)).un === "Visitor");
  const u = JSON.parse(db.get(uid)); db.set(uid, JSON.stringify({ ...u, lastSeen: new Date(Date.now() - 3600e3).toISOString() }));
  await call("GET", "action=me", { cookie: cookieOf(s) });
  await call("GET", "action=me", { cookie: cookieOf(s) });
  assert.equal(JSON.parse(db.get(uid)).visits, 2, "sign-in + one later visit; the immediate reload isn't counted");
});
