// "We ran the numbers" — the Raw Bedrock experiment card. A PUBLISHED NEGATIVE RESULT: the model
// is sound on Bitcoin and does not have enough SPX6900 history to stand up yet, and the card says
// exactly that. NO_ROTATE — hand-posted once, not part of the daily feed.
//
// The shape IS the argument: the orange line sits 50–100× under price for two years, jumps ~20× in
// ten weeks when the percentile target crosses the void in SPX's cost-basis distribution, then goes
// flat. A line that has only been near price since March 2026 has not been tested.
//
// Model + caveats: scripts/bot/bedrock.mjs. Data: public/urpd-history.json (daily cost-basis frames).
// Renders through the shared line-card builder: charts.mjs calls renderLineCard(bedrockSpec(...)).
import { readFileSync } from "node:fs";
import { rawBedrockSeries, bedrockVerdict, DEFAULT_LEVEL } from "./bedrock.mjs";

const PRICE = "#38bdf8", FLOOR = "#f59e0b";

let _cache;
export function bedrockStats() {
  if (_cache !== undefined) return _cache;
  let history = null;
  try { history = JSON.parse(readFileSync(new URL("../../public/urpd-history.json", import.meta.url), "utf8")); }
  catch { return (_cache = null); }
  const { rows } = rawBedrockSeries(history);
  const v = bedrockVerdict(rows);
  return (_cache = v ? { rows, ...v } : null);
}

const fPx = v => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(v < 0.01 ? 4 : 3)}`);

export function bedrockSpec(stats) {
  const { rows } = stats;
  const pts = key => rows.filter(r => r[key] > 0).map(r => [Date.parse(r.d), r[key]]);
  return {
    // The chrome already prints "SPX6900" top-left, so the title must not repeat it.
    title: "WE RAN A BITCOIN FLOOR MODEL ON SPX6900",
    headline: "It needs more history than SPX has",
    accent: FLOOR,
    yLog: true,
    series: [
      { pts: pts("floor"), color: FLOOR, width: 3 },
      { pts: pts("price"), color: PRICE, width: 3.4 },
    ],
    legend: [
      { label: "SPX6900 price", color: PRICE },
      { label: "the model's floor", color: FLOOR },
    ],
    // Keep this under ~95 characters: the footer is a single 21px line and clips past the edge.
    footer: `spx6900rainbow.xyz · Raw Bedrock P${DEFAULT_LEVEL * 100}, after floor.bitview.space · an experiment, not a floor`,
  };
}

// NOTE: this module deliberately does NOT import charts.mjs — charts.mjs imports THIS one for the
// dispatch, and a cycle between them is a module-init footgun waiting to happen. The renderer takes
// the spec; this file only builds it.
