import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { chartTokens, maxTicks, TICK_MIN, BODY_MIN } from "../src/chart-tokens.js";

const css = readFileSync(new URL("../src/terminal.css", import.meta.url), "utf8");

test("the mobile floors are the plan's floors", () => {
  assert.equal(TICK_MIN, 12, "axis text never below 12px");
  assert.equal(BODY_MIN, 16, "explanatory copy at least 16px");
});

test("axis text does NOT shrink on a phone", () => {
  const m = chartTokens({ mobile: true }), d = chartTokens({ mobile: false });
  assert.equal(m.tick, TICK_MIN);
  assert.ok(m.tick >= d.tick, "the phone tick is never smaller than desktop's");
});

test("phone copy is larger, phone plots are shorter", () => {
  const m = chartTokens({ mobile: true }), d = chartTokens({ mobile: false });
  assert.ok(m.body >= BODY_MIN && m.body > d.body, "body copy grows on a phone");
  assert.ok(m.metricLabel >= 12 && m.metricSub >= 12, "metric labels clear the readable floor");
  assert.ok(m.height < d.height, "a portrait plot is shorter");
});

test("touch gets a tap-to-place tooltip; a mouse keeps hover", () => {
  assert.equal(chartTokens({ coarse: true }).tooltipTrigger, "click");
  assert.equal(chartTokens({ coarse: false }).tooltipTrigger, "hover");
});

test("maxTicks scales with width and never returns fewer than two", () => {
  assert.ok(maxTicks(390, true) < maxTicks(1400, false), "a phone fits fewer labels");
  assert.ok(maxTicks(0, true) >= 2 && maxTicks(NaN, true) >= 2, "degenerate widths still give a usable count");
});

test("the CSS safety net carries the same floors for charts not yet on tokens", () => {
  assert.match(css, /\.recharts-cartesian-axis-tick-value[^{]*\{\s*font-size:12px !important/, "axis floor");
  assert.match(css, /\.tzone \.chart-explain\{ font-size:16px; \}/, "explainer floor");
  assert.match(css, /\.tzone \.chart-caption\{ font-size:15px !important/, "caption floor");
});

test("edge x-axis labels are anchored inward, through the layer recharts 3 actually uses", () => {
  // recharts 3 hoists tick labels out of .recharts-xAxis into their own z-index layer; selecting
  // through the axis group matches nothing and fails silently, which is how the first fix "passed".
  assert.match(css, /\.recharts-xAxis-tick-labels > g:last-of-type text\{ text-anchor:end; \}/);
  assert.match(css, /\.recharts-xAxis-tick-labels > g:first-of-type text\{ text-anchor:start; \}/);
});

test("legends scroll sideways on a phone instead of stacking rows", () => {
  assert.match(css, /\.recharts-legend-wrapper\{ overflow-x:auto/);
  assert.match(css, /\.recharts-default-legend\{ white-space:nowrap !important/);
});

test("no chart's mobile y-axis gutter is still sized for 10px ticks", () => {
  // A 40px gutter clipped "$0.0005" to "0.0005" once ticks grew to 12px.
  const offenders = [];
  for (const f of readdirSync(new URL("../src", import.meta.url)).filter(f => f.endsWith(".jsx"))) {
    const src = readFileSync(new URL("../src/" + f, import.meta.url), "utf8");
    for (const m of src.matchAll(/width=\{isMobile \? (\d+) : \d+\}/g)) {
      if (Number(m[1]) < 48) offenders.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(offenders, [], "mobile axis gutters are at least 48px");
});

test("the chart-to-chart flick is an EDGE gesture, not the whole plot", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /const EDGE = \d+;/, "an edge gutter is defined");
  assert.match(app, /fromEdge \? \{ x: t\.clientX/, "the swipe only arms from the edge");
});
