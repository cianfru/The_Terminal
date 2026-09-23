// The Bedrock experiment. The headline property is NO LOOKAHEAD — every day's line must be
// computable from days strictly before it, or the backtest is worthless and the post that says
// "we ran the numbers" is a lie. That is the test that matters here.
import test from "node:test";
import assert from "node:assert/strict";
import { lossAtPrice, priceForLoss, midpoints, rawBedrockSeries, bedrockVerdict, MIN_HISTORY } from "../scripts/bot/bedrock.mjs";
import { bedrockSpec } from "../scripts/bot/bedrock-card.mjs";

// four log-spaced buckets, 25% of supply in each
const EDGES = [1, 2, 4, 8, 16];
const MIDS = midpoints(EDGES);
const FLAT = [25, 25, 25, 25];

test("lossAtPrice counts only supply whose cost basis sits above the price", () => {
  assert.equal(lossAtPrice(FLAT, MIDS, 0.5), 100);      // everything underwater
  assert.equal(lossAtPrice(FLAT, MIDS, 100), 0);        // nothing underwater
  assert.equal(lossAtPrice(FLAT, MIDS, 3), 50);         // the top two buckets
});

test("midpoints are geometric — the edges are log-spaced, so the mean must be too", () => {
  assert.equal(MIDS.length, EDGES.length - 1);
  assert.ok(Math.abs(MIDS[0] - Math.SQRT2) < 1e-12);
});

test("priceForLoss inverts lossAtPrice", () => {
  for (const target of [10, 25, 50, 75, 99]) {
    const p = priceForLoss(FLAT, EDGES, target);
    assert.ok(p > 0, `target ${target} resolves to a price`);
    assert.ok(Math.abs(lossAtPrice(FLAT, MIDS, p) - target) <= 25 + 1e-9,
      `round-trip within one bucket for ${target}`);
  }
});

test("a target the distribution cannot reach returns null, never a fake price", () => {
  assert.equal(priceForLoss(FLAT, EDGES, 101), null);   // >100% underwater is unreachable
  assert.equal(priceForLoss(FLAT, EDGES, 0), null);
});

test("deeper into a bucket means a cheaper price — the inversion is monotone", () => {
  const prices = [10, 30, 60, 90].map(t => priceForLoss(FLAT, EDGES, t));
  for (let i = 1; i < prices.length; i++) assert.ok(prices[i] < prices[i - 1], "more pain ⇒ lower price");
});

// A synthetic history: price walks down, so the loss share walks up.
const history = (n = MIN_HISTORY + 30) => ({
  edges: EDGES,
  weeks: Array.from({ length: n }, (_, i) => ({
    d: new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10),
    spot: 12 - (i / n) * 10,
    pct: FLAT.slice(),
  })),
});

test("NO LOOKAHEAD: a day's line is unchanged by anything that happens after it", () => {
  const full = rawBedrockSeries(history());
  const truncated = rawBedrockSeries({ ...history(), weeks: history().weeks.slice(0, MIN_HISTORY + 10) });
  assert.ok(truncated.rows.length >= 5, "the shorter run still produces rows");
  for (const early of truncated.rows) {
    const same = full.rows.find(r => r.d === early.d);
    assert.equal(same.threshold, early.threshold, `threshold for ${early.d} ignores the future`);
    assert.equal(same.floor, early.floor, `floor for ${early.d} ignores the future`);
  }
});

test("no line at all until a year of loss-share history exists", () => {
  assert.deepEqual(rawBedrockSeries({ ...history(), weeks: history().weeks.slice(0, 200) }).rows, []);
  assert.equal(rawBedrockSeries(history()).rows[0].d, history().weeks[MIN_HISTORY].d);
});

test("the verdict separates 'held above' from 'was ever actually tested'", () => {
  const rows = [
    { d: "a", price: 100, floor: 1, threshold: 1, loss: 1 },   // held, nowhere near
    { d: "b", price: 100, floor: 1, threshold: 1, loss: 1 },   // held, nowhere near
    { d: "c", price: 10, floor: 11, threshold: 1, loss: 1 },   // breached by ~9%
  ];
  const v = bedrockVerdict(rows, { inPlayWithin: 25 });
  assert.equal(v.n, 3);
  assert.equal(v.held, 2);
  assert.equal(v.inPlay, 1, "only the breach day was anywhere near price");
  assert.equal(v.deepestDate, "c");
  assert.ok(v.deepest < 0 && v.deepest > -10);
  assert.ok(v.heldPct > v.inPlayPct, "holding above a line it never approached is not evidence");
});

test("the card calls itself an experiment and never calls the line a floor", () => {
  const stats = { rows: [{ d: "2026-01-01", price: 1, floor: 0.5 }, { d: "2026-01-02", price: 1, floor: 0.5 }],
    inPlay: 1, n: 2, firstInPlay: "2026-01-02" };
  const spec = bedrockSpec(stats);
  assert.match(spec.footer, /experiment, not a floor/);
  assert.ok(spec.footer.length < 100, "the footer is one 21px line — longer clips off the card");
  assert.equal(spec.series.length, 2);
  assert.ok(spec.yLog, "a 100x price range needs a log axis");
});
