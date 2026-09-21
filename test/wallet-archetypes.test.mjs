import test from "node:test";
import assert from "node:assert/strict";
import { archetype, retention, skew, BALANCED, MANY_CP } from "../scripts/build-wallet-archetypes.mjs";

const P = o => ({ txIn:0, txOut:0, cp:0, volIn:0, volOut:0, venuesIn:0, venuesOut:0, kind:null, ...o });

test("retention is +1 when nothing ever left, -1 when nothing ever arrived", () => {
  assert.equal(retention(P({ volIn: 100 })), 1);
  assert.equal(retention(P({ volOut: 100 })), -1);
  assert.equal(retention(P({ volIn: 50, volOut: 50 })), 0);
  assert.equal(retention(P({})), 0);                       // no division by zero
});

test("a hand label always wins — the classifier never overrides the owner", () => {
  const r = archetype(P({ kind: "cex", cp: 500, volIn: 1e9, volOut: 1e9 }));
  assert.equal(r.type, "cex");
});

test("value passing through many hands with none kept is a router", () => {
  const r = archetype(P({ txIn: 50, txOut: 50, cp: 40, volIn: 1_000_000, volOut: 1_000_000 }));
  assert.equal(r.type, "router");
});

test("balanced flow across FEW counterparties is not a router", () => {
  // two wallets passing value back and forth is a pair, not infrastructure
  const r = archetype(P({ txIn: 50, txOut: 50, cp: 2, volIn: 1_000_000, volOut: 1_000_000 }));
  assert.notEqual(r.type, "router");
});

test("venue reach outranks the flow shape", () => {
  // balanced and wide, but it touched several tagged exchanges: that is the better description
  const r = archetype(P({ txIn: 50, txOut: 50, cp: 40, volIn: 1e6, volOut: 1e6, venuesIn: 2, venuesOut: 2 }));
  assert.equal(r.type, "exchange-adjacent");
});

test("keeping most of what arrives is accumulating", () => {
  assert.equal(archetype(P({ txIn: 20, txOut: 2, cp: 5, volIn: 1_000_000, volOut: 100_000 })).type, "accumulator");
});

test("sending out far more than arrived is draining", () => {
  assert.equal(archetype(P({ txIn: 2, txOut: 20, cp: 5, volIn: 100_000, volOut: 1_000_000 })).type, "drainer");
});

test("many small receipts, few sends is a collector; the reverse is a distributor", () => {
  assert.equal(archetype(P({ txIn: 40, txOut: 2, cp: 9, volIn: 300_000, volOut: 250_000 })).type, "collector");
  assert.equal(archetype(P({ txIn: 2, txOut: 40, cp: 9, volIn: 300_000, volOut: 250_000 })).type, "distributor");
});

test("every archetype carries a reason a person can check", () => {
  for (const p of [P({ txIn:50, txOut:50, cp:40, volIn:1e6, volOut:1e6 }),
                   P({ volIn: 1e6, txIn: 9 }), P({ volOut: 1e6, txOut: 9 })]) {
    const r = archetype(p);
    assert.ok(r.why && r.why.length > 5, `no reason for ${r.type}`);
  }
});

test("thresholds are exported so the published numbers can be re-derived", () => {
  assert.ok(BALANCED > 0 && BALANCED < 0.2);
  assert.ok(MANY_CP >= 5);
});
