// The Jev client. It sits in front of a paid, non-deterministic service on a project whose whole
// value is reproducible numbers, so what matters is not that it works — it is that it FAILS SOFT
// and never becomes load-bearing.
import test from "node:test";
import assert from "node:assert/strict";
import { ask, choice, score, noul, band, BANDS, preview, hasKey } from "../scripts/bot/jev.mjs";

const OK = body => async () => ({ ok: true, json: async () => body });
const withKey = async fn => { const k = process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY = "test"; try { return await fn(); } finally { k === undefined ? delete process.env.TYPESAFE_API_KEY : process.env.TYPESAFE_API_KEY = k; } };

test("question builders match the documented shapes", () => {
  assert.deepEqual(choice("pick", { a: "A" }), { type: "choice", instructions: "pick", criteria: { a: "A" } });
  assert.deepEqual(score("rate", ["low", "high"]), { type: "score", instructions: "rate", criteria: ["low", "high"] });
  assert.deepEqual(noul("is it"), { type: "noul", instructions: "is it" });
});

test("no key → null, and the network is never touched", async () => {
  let called = false;
  const r = await ask("state", { q: noul("x") }, { fetchImpl: async () => { called = true; } });
  assert.equal(r, null);
  assert.equal(called, false, "a keyless call must not even attempt a request");
});

test("returns the answers when the service answers", async () => {
  const body = { model: "jev-latest", answers: { q: { type: "noul", noul: 0.91 } }, usage: { input_tokens: 10 } };
  const r = await withKey(() => ask("s", { q: noul("x") }, { fetchImpl: OK(body) }));
  assert.equal(r.answers.q.noul, 0.91);
});

test("every failure mode returns null rather than throwing — analytics must never break a build", async () => {
  const cases = {
    "http error": async () => ({ ok: false, status: 500, json: async () => ({}) }),
    "network throw": async () => { throw new Error("ECONNRESET"); },
    "malformed body": async () => ({ ok: true, json: async () => ({ nope: 1 }) }),
    "json throws": async () => ({ ok: true, json: async () => { throw new Error("bad json"); } }),
  };
  for (const [label, fetchImpl] of Object.entries(cases)) {
    const r = await withKey(() => ask("s", { q: noul("x") }, { fetchImpl }));
    assert.equal(r, null, `${label} must return null`);
  }
});

test("an empty question set is a no-op", async () => {
  assert.equal(await withKey(() => ask("s", {}, { fetchImpl: OK({ answers: {} }) })), null);
  assert.equal(await withKey(() => ask("s", null, { fetchImpl: OK({ answers: {} }) })), null);
});

test("the request is the documented POST shape", async () => {
  let seen = null;
  await withKey(() => ask("the state", { q: noul("x") }, {
    fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ answers: { q: { noul: 1 } } }) }; },
  }));
  assert.match(seen.url, /\/v1\/systemone$/);
  assert.equal(seen.init.method, "POST");
  assert.match(seen.init.headers.Authorization, /^Bearer /);
  const body = JSON.parse(seen.init.body);
  assert.equal(body.model, "jev-latest");
  assert.equal(body.state, "the state");
  assert.ok(body.questions.q);
});

test("a non-string state is serialised, not dropped", async () => {
  let body = null;
  await withKey(() => ask({ wallet: "0x1", vol: 5 }, { q: noul("x") }, {
    fetchImpl: async (_u, i) => { body = JSON.parse(i.body); return { ok: true, json: async () => ({ answers: {} }) }; },
  }));
  assert.equal(body.state, '{"wallet":"0x1","vol":5}');
});

test("confidence bands follow the docs: act / review / route to a human", () => {
  assert.equal(band(0.9), "act");
  assert.equal(band(BANDS.act), "act");
  assert.equal(band(0.5), "review");
  assert.equal(band(0.1), "ask-a-human");
  assert.equal(band(undefined), "unknown", "a Noul carries no confidence — do not treat that as certainty");
  assert.ok(BANDS.act > BANDS.review);
});

test("preview shows the exact request without sending it", () => {
  const p = preview("s", { q: noul("x") });
  assert.match(p.endpoint, /typesafe/);
  assert.equal(p.body.state, "s");
  assert.ok(p.body.questions.q);
});

test("hasKey reflects the environment", () => {
  assert.equal(typeof hasKey(), "boolean");
});
