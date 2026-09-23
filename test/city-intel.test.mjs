// The City Intel page's reads. The page puts population, value, arrivals and movement side by side,
// so the thing worth pinning is that they agree with each other and with the rest of the site.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cityIntel, cityMovement, citizensOf, tvlOf, TIER_LABELS, TIER_BOUNDS } from "../src/city-intel.js";

const J = f => JSON.parse(readFileSync(new URL(`../public/${f}`, import.meta.url), "utf8"));
const hist = J("city-history.json"), whales = J("whales.json");
const oc = J("onchain.json").at(-1);
const ci = cityIntel(hist, { circulating: 1e9 - oc.burnBal });
const mv = cityMovement(whales);

const row = (counts, vals, d = "2024-01-01", p = 1) => [d, p, ...counts, ...vals];

test("citizens and value read the right columns of a row", () => {
  const r = row([1, 2, 3, 4, 5, 6], [10, 20, 30, 40, 50, 60]);
  assert.equal(citizensOf(r), 21);
  assert.equal(tvlOf(r), 210);
});

test("the tiers are the whole city — shares sum to 100", () => {
  assert.ok(ci, "intel builds from the committed city-history.json");
  assert.equal(ci.tiers.length, TIER_LABELS.length);
  assert.ok(Math.abs(ci.tiers.reduce((a, t) => a + t.n, 0) - ci.citizens) < 1, "tier counts are the population");
  assert.ok(Math.abs(ci.tiers.reduce((a, t) => a + t.tvl, 0) - ci.tvl) < 1, "tier values are the city value");
  for (const k of ["shareN", "shareTvl"]) {
    assert.ok(Math.abs(ci.tiers.reduce((a, t) => a + t[k], 0) - 100) < 0.01, `${k} sums to 100%`);
  }
});

test("arrivals minus departures reconciles to the change in population", () => {
  // this is the page's one cross-section claim: the flow chart and the headline must be the same event
  assert.equal(ci.arrived - ci.left, ci.netArrivals);
  assert.equal(ci.netArrivals, ci.citizens30.d, "30 days of flow IS the 30-day change in citizens");
});

test("the city's tokens are its value at its own price, and a share of the tradable supply", () => {
  assert.ok(Math.abs(ci.tokens * ci.price - ci.tvl) < 1, "tokens x price = value");
  assert.ok(ci.shareOfCirculating > 0 && ci.shareOfCirculating < 100);
});

test("movement classifies on the project-wide dust rule, and accounts for every wallet", () => {
  assert.ok(mv, "movement builds from whales.json");
  assert.equal(mv.buy + mv.sell + mv.flat, mv.tiers.reduce((a, t) => a + t.buy + t.sell + t.flat, 0));
  assert.ok(Math.abs(mv.net - mv.tiers.reduce((a, t) => a + t.net, 0)) < 1);
  // a move must clear 0.5% of the bag, min 1,000 SPX — same rule as the whale cards
  const fake = { wallets: [
    { bal: 1e6, d30: 4000 },    // 0.4% — dust
    { bal: 1e6, d30: 6000 },    // 0.6% — a buy
    { bal: 1e5, d30: -900 },    // under the 1,000 floor — dust
    { bal: 1e5, d30: -1200 },   // a sell
  ] };
  const m = cityMovement(fake);
  assert.equal(m.buy, 1); assert.equal(m.sell, 1); assert.equal(m.flat, 2);
});

test("movement reports flow only — never a second population for the page to contradict", () => {
  // whales.json's own citizen count differs from the history's by construction, so the movement
  // table must not carry one. It may report how many wallets it TRACKS, which is a different word.
  for (const t of mv.tiers) {
    assert.ok(!("citizens" in t) && !("n" in t), `${t.label} exposes no population`);
  }
  assert.ok(Number.isFinite(mv.tracked), "it does say how many wallets it read");
});

test("the window selector actually changes the numbers", () => {
  const d1 = cityMovement(whales, { window: "d1" }), d30 = cityMovement(whales, { window: "d30" });
  assert.notEqual(d1.net, d30.net, "a day and a month are not the same flow");
  assert.ok(d1.flat > d30.flat, "fewer wallets move in a day than in a month");
});

test("tier bounds are contiguous and cover everything above the residency floor", () => {
  assert.equal(TIER_BOUNDS[0][0], 5000, "the city's floor");
  for (let i = 1; i < TIER_BOUNDS.length; i++) assert.equal(TIER_BOUNDS[i][0], TIER_BOUNDS[i - 1][1], "no gap between tiers");
  assert.equal(TIER_BOUNDS.at(-1)[1], Infinity, "the top tier is open-ended");
});

test("too little history yields nothing rather than a misleading page", () => {
  assert.equal(cityIntel({ rows: [row([1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0])] }), null);
  assert.equal(cityIntel(null), null);
  assert.equal(cityMovement({ wallets: [] }), null);
});
