import { test } from "node:test";
import assert from "node:assert/strict";
import { turnover, flagExchanges, topShare, rawWithInfra } from "../scripts/zec-vs-spx-concentration.mjs";

test("turnover: cold whale ~1x, hot wallet high, zero balance -> null", () => {
  assert.equal(turnover({ balance: 100e8, received: 100e8 }), 1);
  assert.equal(turnover({ balance: 100e8, received: 1000e8 }), 10);
  assert.equal(turnover({ balance: 0, received: 500e8 }), null);
});

test("flagExchanges: threshold is inclusive, cold holders survive", () => {
  const f = flagExchanges({
    cold: { balance: 100e8, received: 100e8 },      // 1.0x
    mixed: { balance: 100e8, received: 250e8 },     // 2.5x
    hot: { balance: 100e8, received: 300e8 },       // 3.0x -> flagged
    veryhot: { balance: 10e8, received: 2000e8 },   // 200x -> flagged
  });
  assert.deepEqual([...f].sort(), ["hot", "veryhot"]);
});

test("topShare: sorts before slicing, guards a zero denominator", () => {
  assert.equal(topShare([1, 50, 20, 5], 2, 100), 70);   // 50+20
  assert.equal(topShare([10], 5, 100), 10);            // n beyond length
  assert.equal(topShare([10], 1, 0), null);
});

test("rawWithInfra: folding infrastructure back in raises the share", () => {
  // 50% of 100 held, plus 100 of infra that is all top-100 => 150/200
  assert.equal(rawWithInfra(0.5, 100, 100), 75);
  // no infrastructure -> unchanged
  assert.equal(rawWithInfra(0.5, 100, 0), 50);
  assert.equal(rawWithInfra(0.5, 0, 0), null);
});

test("rawWithInfra reproduces SPX's known raw top-100 (~68%)", () => {
  const got = rawWithInfra(0.5666, 615_260_711, 194_777_657 + 12_229_402);
  assert.ok(got > 67 && got < 68, `expected ~67.6, got ${got}`);
});
