// The cost-basis terrain's DATA and VIEW axes. The renderer can't be tested here (no GPU), but
// every number it draws comes from these pure transforms, so this is where the honesty lives.
import test from "node:test";
import assert from "node:assert/strict";
import { bucketValues, terrainSeries, midpoints, heightRef, axisTicks, fmtValue, viewDays, axisLabelFor, DATA_MODES, VIEW_MODES } from "../src/urpd-terrain.js";

const EDGES = [1, 2, 4, 8];                 // three log-spaced buckets
const MIDS = midpoints(EDGES);
const day = i => new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
// 100 tokens held, split 50/30/20 across the buckets, spot 3
const frame = (i, pct = [50, 30, 20], spot = 3) => ({ d: day(i), spot, pct });
const hist = (n = 40, mk = frame) => ({ edges: EDGES, nBuckets: 3, weeks: Array.from({ length: n }, (_, i) => mk(i)) });
const held = (n = 40, v = 100) => Object.fromEntries(Array.from({ length: n }, (_, i) => [day(i), v]));

test("supply is the untouched percentage — the original view cannot regress", () => {
  assert.deepEqual(bucketValues(frame(0), MIDS, "supply", 100), [50, 30, 20]);
});

test("capital is what that supply cost, pnl is what it made since", () => {
  const cap = bucketValues(frame(0), MIDS, "capital", 100);
  const pnl = bucketValues(frame(0), MIDS, "pnl", 100);
  // bucket 0: 50 tokens at a cost basis of sqrt(1*2)
  assert.ok(Math.abs(cap[0] - 50 * Math.SQRT2) < 1e-9);
  assert.ok(Math.abs(pnl[0] - 50 * (3 - Math.SQRT2)) < 1e-9);
  // the invariant that makes both trustworthy: cost + gain = what it is worth at spot
  for (let i = 0; i < 3; i++) {
    const tokens = [50, 30, 20][i];
    assert.ok(Math.abs((cap[i] + pnl[i]) - tokens * 3) < 1e-9, `bucket ${i} reconciles to market value`);
  }
});

test("a USD mode with no supply figure for the day yields nothing for that day", () => {
  assert.equal(bucketValues(frame(0), MIDS, "capital", 0), null);
  assert.equal(bucketValues(frame(0), MIDS, "pnl", undefined), null);
  assert.deepEqual(bucketValues(frame(0), MIDS, "supply", undefined), [50, 30, 20], "supply never needs it");
});

test("one missing day costs that day, not the whole mode", () => {
  const h = held(40); delete h[day(7)];
  const s = terrainSeries(hist(), h, { data: "capital", view: "value" });
  assert.equal(s.ok, true);
  assert.equal(s.frames.length, 39);
  assert.ok(!s.frames.some(f => f.d === day(7)));
});

test("change views difference against the day N days earlier, by DATE not by index", () => {
  // supply rotates from bucket 0 into bucket 2 over time
  const h = hist(40, i => frame(i, [50 - i, 30, 20 + i]));
  const s = terrainSeries(h, held(40), { data: "supply", view: "d7" });
  assert.equal(viewDays("d7"), 7);
  assert.equal(s.frames[0].d, day(7), "the first 7 days have nothing to difference against");
  assert.equal(s.frames.length, 33);
  assert.deepEqual(s.frames[0].v, [-7, 0, 7], "exactly seven days of drift, not 'seven slices'");
});

test("a change window longer than the history falls back rather than inventing a surface", () => {
  const s = terrainSeries(hist(40), held(40), { data: "supply", view: "d365" });
  assert.equal(s.ok, false);
  assert.equal(s.view, "value", "fell back to the level");
  assert.ok(s.frames.length > 0);
});

test("signed is set for P&L and for every change view, and only there", () => {
  const S = (data, view) => terrainSeries(hist(), held(), { data, view }).signed;
  assert.equal(S("supply", "value"), false);
  assert.equal(S("capital", "value"), false);
  assert.equal(S("pnl", "value"), true, "P&L is already signed — colour by sign, not by spot");
  assert.equal(S("supply", "d30"), true);
  assert.equal(S("capital", "d30"), true);
});

test("the supply change view redistributes — it always nets to zero", () => {
  const s = terrainSeries(hist(40, i => frame(i, [50 - i, 30, 20 + i])), held(40), { data: "supply", view: "d30" });
  for (const f of s.frames) assert.ok(Math.abs(f.v.reduce((a, b) => a + b, 0)) < 1e-9);
});

test("units, labels and gridlines follow the mode", () => {
  assert.equal(terrainSeries(hist(), held(), { data: "supply", view: "value" }).unit, "%");
  assert.equal(terrainSeries(hist(), held(), { data: "pnl", view: "value" }).unit, "$");
  assert.equal(axisLabelFor("capital", "d30"), "invested capital · 1M change");
  assert.equal(axisLabelFor("supply", "value"), "% of supply");
  assert.equal(fmtValue(12, "%"), "12%");
  assert.equal(fmtValue(2.5e6, "$"), "$2.5M");
  // Ticks are fractions of the height reference, so they SPREAD across the visible height instead of
  // piling into the bottom sliver the way a 1/2/5-per-decade ladder does under the height gamma.
  // They may sit above the reference — the terrain itself is clamped at 2.6x it.
  const t = axisTicks(12);
  assert.ok(t.length >= 3 && t.length <= 5);
  assert.deepEqual(t.slice().sort((a, b) => a - b), t, "ascending");
  assert.ok(t.every(v => v > 0 && v <= 12 * 2.6), "nothing above what the terrain can reach");
  assert.ok(t.at(-1) / t[0] >= 4, "spread across the axis, not bunched");
  assert.deepEqual(axisTicks(12), [2, 5, 10, 20], "and they land on round numbers");
  assert.deepEqual(axisTicks(0), [], "no reference, no gridlines");
});

test("the height reference ignores the launch spike (p97, not max)", () => {
  // p97 only has room to sit below the max once there are enough samples — which is the real case
  // (1,100 days x 40 buckets). SPX's launch week parks ~100% of supply in one bucket; scaling the
  // terrain to that would flatten every other day into a plain.
  const frames = Array.from({ length: 200 }, () => ({ v: [1, 1, 1] }));
  frames.push({ v: [900, 0, 0] });
  const ref = heightRef(frames);
  assert.ok(ref < 900, "one 900 cannot flatten the rest");
  assert.equal(ref, 1);
  assert.equal(heightRef([]), 1e-6, "an empty surface still returns a usable reference");
});

test("every advertised mode actually builds", () => {
  for (const [d] of DATA_MODES) for (const [v] of VIEW_MODES) {
    const s = terrainSeries(hist(400, i => frame(i)), held(400), { data: d, view: v });
    assert.ok(s.frames.length > 0, `${d}/${v} produces a surface`);
    assert.ok(s.frames.every(f => Array.isArray(f.v) && f.v.length === 3), `${d}/${v} is well formed`);
  }
});
