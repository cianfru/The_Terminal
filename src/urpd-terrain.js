// COST-BASIS TERRAIN — the value transforms behind the 3D chart (UrpdTerrain3D.jsx).
//
// The terrain's shape is always the same: X = cost basis, Z = time, Y = "how much". What changes is
// WHAT is being stacked, and whether you look at the level or at the change. Both axes are pure
// arithmetic over files we already ship — urpd-history.json (daily cost-basis frames on one fixed
// price grid) joined to onchain.json's heldTokens — so nothing here needs a new feed.
//
//   DATA   supply            % of held supply sitting in each cost-basis bucket (the original view)
//          capital           what that supply COST: tokens × the bucket's cost basis, in USD
//          pnl               what it is worth now vs what it cost: tokens × (spot − cost basis)
//
//   VIEW   value             the level, as it stands on that day
//          1W/1M/3M/1Y       the level minus the level N days earlier — the terrain as a DELTA
//                            surface, which is the only view that shows WHICH cost-basis bands are
//                            being accumulated or distributed rather than merely where supply sits.
//
// ⚠ The change views are differenced on the DAILY frames, before any downsampling for rendering —
// diffing a thinned series would silently turn "1 month" into "however many slices survived".
//
// `signed` tells the renderer how to colour: an unsigned surface (a level of supply or capital) is
// coloured in profit/underwater against that day's spot, while a signed one (P&L, or any change) is
// coloured by its own sign — green above zero, red below — because "in profit" is already baked in.

export const DATA_MODES = [
  ["supply", "Supply"],
  ["capital", "Invested capital"],
  ["pnl", "Unrealized P&L"],
];

// [key, label, days]. Kept shorter than Bitview's eight: on ~3 years of history the long windows
// eat most of the series, and every extra tab costs a mobile row.
export const VIEW_MODES = [
  ["value", "Value", 0],
  ["d7", "1W change", 7],
  ["d30", "1M change", 30],
  ["d90", "3M change", 90],
  ["d365", "1Y change", 365],
];

export const viewDays = key => (VIEW_MODES.find(v => v[0] === key) || VIEW_MODES[0])[2];
export const viewLabel = key => (VIEW_MODES.find(v => v[0] === key) || VIEW_MODES[0])[1];
export const dataLabel = key => (DATA_MODES.find(v => v[0] === key) || DATA_MODES[0])[1];

/** Y-axis caption: what the height of the terrain actually measures in this mode. */
export const axisLabelFor = (data, view) =>
  (data === "supply" ? "% of supply" : data === "capital" ? "invested capital" : "unrealized P&L")
  + (viewDays(view) ? ` · ${viewLabel(view).replace(" change", "")} change` : "");

/** Geometric bucket midpoints — the price edges are log-spaced, so the mean must be too. */
export const midpoints = edges => edges.slice(0, -1).map((lo, i) => Math.sqrt(lo * edges[i + 1]));

/**
 * Per-bucket quantity for one daily frame.
 *  supply  → % of held supply (unchanged from the original terrain, so that view cannot regress)
 *  capital → USD that supply cost
 *  pnl     → USD it has gained or lost since
 * `held` is that day's tracked token supply (onchain.json heldTokens); without it the USD modes
 * cannot be formed, so they return null and the caller falls back to supply.
 */
export function bucketValues(frame, mids, data, held) {
  const pct = frame.pct || [];
  if (data === "supply") return pct.slice();
  if (!(held > 0)) return null;
  const spot = frame.spot || 0;
  return pct.map((p, i) => {
    const tokens = (p / 100) * held;
    return data === "capital" ? tokens * mids[i] : tokens * (spot - mids[i]);
  });
}

/**
 * The full series the renderer draws.
 * @param hist         public/urpd-history.json — { edges, nBuckets, weeks:[{d, spot, pct[]}] }
 * @param heldByDate   date → heldTokens (from onchain.json); only needed for the USD modes
 * @returns { frames:[{d, spot, v:[]}], signed, unit, data, view, ok }
 *          `ok:false` means the request could not be honoured (missing supply join, or a change
 *          window longer than the history) and the caller was given the plain supply level instead.
 */
export function terrainSeries(hist, heldByDate = {}, { data = "supply", view = "value" } = {}) {
  const fallback = () => terrainSeries(hist, heldByDate, { data: "supply", view: "value" });
  const daily = (hist?.weeks || []).filter(f => Array.isArray(f.pct));
  if (!daily.length) return { frames: [], signed: false, unit: "%", axisLabel: axisLabelFor("supply", "value"), data: "supply", view: "value", ok: true };

  const mids = midpoints(hist.edges);
  // A day with no supply figure simply cannot be valued in USD — drop THAT DAY rather than the whole
  // mode (the very first frame predates the engine's first onchain row, and losing the feature over
  // one missing day would be absurd). Only an empty result falls back.
  const kept = [];
  for (const f of daily) {
    const v = bucketValues(f, mids, data, heldByDate[f.d]);
    if (v) kept.push({ f, v });
  }
  if (kept.length < 8) return { ...fallback(), ok: false };
  const levels = kept.map(k => k.v), rows = kept.map(k => k.f);

  const days = viewDays(view);
  let frames;
  if (!days) {
    frames = rows.map((f, i) => ({ d: f.d, spot: f.spot, v: levels[i] }));
  } else {
    const at = new Map(rows.map((f, i) => [f.d, i]));
    const back = d => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - days); return t.toISOString().slice(0, 10); };
    frames = [];
    for (let i = 0; i < rows.length; i++) {
      const j = at.get(back(rows[i].d));
      if (j == null) continue;                       // no matching earlier day → no delta, drawn nowhere
      frames.push({ d: rows[i].d, spot: rows[i].spot, v: levels[i].map((x, k) => x - levels[j][k]) });
    }
    if (frames.length < 8) return { ...fallback(), ok: false };   // window longer than the history
  }

  return {
    frames,
    signed: data === "pnl" || !!days,
    unit: data === "supply" ? "%" : "$",
    axisLabel: axisLabelFor(data, view),
    data, view, ok: true,
  };
}

/** A robust height reference — the p97 of non-zero magnitudes, so one launch-week spike can't flatten the rest. */
export function heightRef(frames) {
  const mags = [];
  for (const f of frames) for (const v of f.v) { const a = Math.abs(v); if (a > 0) mags.push(a); }
  if (!mags.length) return 1e-6;
  mags.sort((a, b) => a - b);
  return mags[Math.floor(mags.length * 0.97)] || mags.at(-1);
}

const SI = v => {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
  return String(Math.round(v));
};

/** Axis label for a magnitude, in the series' own unit. */
export const fmtValue = (v, unit) => (unit === "%" ? `${+v.toFixed(v < 1 ? 2 : 0)}%` : `$${SI(v)}`);

/**
 * Gridline magnitudes, chosen as FRACTIONS OF THE HEIGHT REFERENCE rather than a 1/2/5-per-decade
 * ladder. The terrain's height curve is a gamma, which squashes small magnitudes together — a decade
 * ladder therefore piles most of its ticks into the bottom sliver of the axis (the original fixed
 * 5/10/15/20/25% ticks did not have this problem, and neither must this). Spacing them across the
 * visible height by construction keeps every axis readable in every unit.
 */
export function axisTicks(ref, max = 5) {
  if (!(ref > 0)) return [];
  const nice = v => {
    const e = 10 ** Math.floor(Math.log10(v)), f = v / e;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
  };
  const want = [0.2, 0.4, 0.7, 1, 1.6, 2.4].map(f => nice(ref * f));
  const out = [...new Set(want)].filter(v => v > 0).sort((a, b) => a - b);
  // keep the tallest `max`, but never drop the smallest one — the axis needs a low reference
  return out.length <= max ? out : [out[0], ...out.slice(-(max - 1))];
}
