// The denominator bridge. This card exists because the 90% figure gets read as a claim about ALL
// supply, so the one thing it must never do is get the split wrong.
import test from "node:test";
import assert from "node:assert/strict";
import { Resvg } from "@resvg/resvg-js";
import { supplyBridgeStats, supplyBridgeSvg, renderSupplyBridgeCard } from "../scripts/bot/supply-bridge-card.mjs";

const s = supplyBridgeStats();

test("the split reconciles to the whole token supply", () => {
  assert.ok(s, "stats build from the committed onchain.json");
  const total = s.held + s.cex + s.lp + s.bridge + s.burn;
  assert.ok(Math.abs(total - 1e9) < 1e6, `held+cex+lp+bridge+burn = ${total}, expected 1B`);
  assert.ok(Math.abs((s.circulating + s.burn) - 1e9) < 1, "circulating excludes exactly the burn");
});

test("diamond is a share of HELD, and the card also states it against circulating", () => {
  assert.ok(Math.abs(s.diamond / s.held * 100 - s.diamondPct) < 1e-6, "diamondPct is measured on held supply");
  assert.ok(Math.abs(s.diamond / s.circulating * 100 - s.diamondOfAll) < 1e-6, "diamondOfAll is measured on circulating");
  assert.ok(s.diamondOfAll < s.diamondPct, "the bridge only ever makes the number smaller — that is the point");
});

test("held is exactly diamond + fresh, so the top bracket spans what it claims", () => {
  assert.ok(Math.abs((s.diamond + s.fresh) - s.held) < 1, "no supply falls between the two self-custody segments");
});

test("the excluded slice is everything outside self-custody, and sell-ready is not the same thing", () => {
  assert.ok(Math.abs(s.excluded - (s.cex + s.lp + s.bridge)) < 1);
  assert.ok(Math.abs(s.sellReady - (s.cex + s.lp + s.fresh)) < 1, "sell-ready counts fresh coins and NOT the bridge");
  assert.ok(s.sellReady < s.excluded + s.fresh);
});

test("the bar's segments fill the circulating supply exactly once", () => {
  const svg = supplyBridgeSvg(s);
  // width > 2 excludes the hairline dividers drawn at the same y and height
  const widths = [...svg.matchAll(/<rect x="[\d.]+" y="\d+" width="([\d.]+)" height="122"/g)]
    .map(m => +m[1]).filter(w => w > 2);
  assert.equal(widths.length, 5, "five segments");
  const barW = 1200 - 64 - 64;
  assert.ok(Math.abs(widths.reduce((a, b) => a + b, 0) - barW) < 1.5, "segments tile the whole bar");
});

test("nothing is clipped at the edges of the rendered card", () => {
  // Estimating text widths is how clipped labels ship. Render it and look at the pixels: any ink in
  // the outermost columns means something ran off. (The brand stripe owns the first ~11px by design.)
  const png = renderSupplyBridgeCard(s);
  const img = new Resvg(supplyBridgeSvg(s)).render();
  const { width, height } = img;
  const px = img.pixels;
  const lit = (x0, x1) => {
    let n = 0;
    for (let y = 0; y < height; y++) for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (px[i] > 70 || px[i + 1] > 70 || px[i + 2] > 70) n++;
    }
    return n;
  };
  assert.ok(png.length > 1000, "the card rasterizes");
  assert.equal(lit(width - 5, width), 0, "no ink in the last five columns — a label ran off the right edge");
});

test("it renders at the square aspect too, without the numbers changing", () => {
  const wide = supplyBridgeSvg(s, { W: 1200, H: 800 });
  const square = supplyBridgeSvg(s, { W: 1200, H: 1200 });
  for (const n of [s.diamond, s.cex, s.excluded].map(v => (v / 1e6).toFixed(1) + "M")) {
    assert.ok(wide.includes(n) && square.includes(n), `${n} survives both aspects`);
  }
});

// ── the historical version ────────────────────────────────────────────────────────────────────
import { diamondGapSeries, diamondGapSpec } from "../scripts/bot/supply-bridge-card.mjs";

const g = diamondGapSeries();

test("the gap series builds, and the two denominators can never cross", () => {
  assert.ok(g && g.rows.length > 300, "a real daily series");
  for (const r of g.rows) {
    assert.ok(r.ofCirc <= r.ofHeld + 1e-9, `${r.d}: measuring against MORE supply can only give a smaller share`);
    for (const v of [r.ofHeld, r.ofCirc, r.exch]) assert.ok(v >= 0 && v <= 100, `${r.d}: ${v} is a percentage`);
  }
});

test("the gap is what the excluded supply does — zero when nothing is excluded", () => {
  const early = g.rows.find(r => r.exch === 0 && r.ofHeld > 0);
  const now = g.cur;
  assert.ok(now.ofHeld - now.ofCirc > 20, "today the two readings are tens of points apart");
  if (early) assert.ok((early.ofHeld - early.ofCirc) < (now.ofHeld - now.ofCirc), "the gap widened as supply left self-custody");
});

test("the copy's reference point is matched by date, not by row count", () => {
  assert.ok(g.then, "a ~16-month-back reading exists");
  const days = (g.cur.ts - g.then.ts) / 86400000;
  assert.ok(days >= 470 && days <= 500, `reference is ~480 days back, got ${Math.round(days)}`);
});

test("the spec labels a percentage axis as percent, and its title fits the fixed-size header", () => {
  const spec = diamondGapSpec(g);
  assert.equal(spec.yFmt(60), "60%", "the builder defaults to dollars — this axis is not dollars");
  assert.equal(spec.yMin, 0); assert.equal(spec.yMax, 100);
  // the chrome's title is a fixed 38px and does NOT auto-fit; only the headline shrinks
  assert.ok(spec.title.length <= 38, `title "${spec.title}" must clear a 1200px card unaided`);
  assert.equal(spec.series.length, 3);
  assert.equal(spec.legend.length, 3);
});
