// RAW BEDROCK, ported to SPX6900 — a published NEGATIVE result.
//
// The model is Bitview's ("Finding the Floor", floor.bitview.space, built on the Bitcoin Research
// Kit). It does not fit a curve to old bottoms; it inverts the holder base:
//
//   1. take the daily share of supply sitting underwater,
//   2. rank today against that series' own history — using ONLY days before today, so there is no
//      lookahead — at some percentile (P90 here),
//   3. scan today's cost-basis distribution for the price at which that many coins WOULD be
//      underwater. That price is Bedrock.
//
// The claim is a state, not a target: "at this price the holder base would be in a degree of pain
// it has rarely been in." On Bitcoin's 17 years that is a meaningful rank. On SPX6900's three it
// is NOT, and the numbers here say so out loud:
//
//   • P98 and above resolve to a 100%-underwater threshold — SPX's launch week, a regime that
//     cannot recur. Unreachable at any price. (Same trap as the launch-anchored founders cohort.)
//   • The answer is violently unstable, because SPX's cost-basis distribution has a VOID: only
//     ~13pp of supply sits anywhere between $0.0135 and $0.29, a 20× price range. Seven points of
//     threshold move the answer roughly 15×.
//   • The backtest flatters. The line sat 50–100× below price for two years — never tested — then
//     jumped ~20× in ten weeks when the target crossed that void. "99% of closes held above it"
//     is arithmetic, not evidence.
//
// So this ships as an experiment, labelled as one, and the level is NOT tuned to make the
// backtest look good (P90 is the lowest rank whose threshold is not launch-contaminated; P85 and
// P88 breach by 29% and 16%, P92 is never touched — that sensitivity IS the finding).
//
// Revisit when there is a second cycle of holder history. Until then the honest output of this
// file is "not yet".
//
// Pure: every function takes data and returns data, so it is unit-testable and re-runnable
// unchanged next year. Reads public/urpd-history.json (daily cost-basis frames over fixed edges).

export const DEFAULT_LEVEL = 0.90;
export const MIN_HISTORY = 365;          // no line until a year of loss-share history exists

// Bucket midpoints. The edges are log-spaced, so the geometric mean is the honest centre.
export const midpoints = edges => edges.slice(0, -1).map((lo, i) => Math.sqrt(lo * edges[i + 1]));

/** Share of held supply whose cost basis sits ABOVE `price` — i.e. underwater at that price. */
export function lossAtPrice(pct, mids, price) {
  let s = 0;
  for (let i = pct.length - 1; i >= 0; i--) {
    if (mids[i] <= price) break;
    s += pct[i];
  }
  return s;
}

/**
 * The inverse: the price at which the loss share would equal `target`. Walks down from the most
 * expensive bucket and interpolates in LOG price inside the bucket where the total crosses.
 * Returns null when the target exceeds the whole distribution (an unreachable ask).
 */
export function priceForLoss(pct, edges, target) {
  if (!(target > 0)) return null;
  let cum = 0;
  for (let i = pct.length - 1; i >= 0; i--) {
    const next = cum + pct[i];
    if (next >= target) {
      if (!(pct[i] > 0)) return Math.sqrt(edges[i] * edges[i + 1]);
      const f = (target - cum) / pct[i];                        // how far into this bucket
      const lo = Math.log(edges[i]), hi = Math.log(edges[i + 1]);
      return Math.exp(hi - f * (hi - lo));                      // deeper in → cheaper
    }
    cum = next;
  }
  return null;
}

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null);

/**
 * The full historical line. `history` is public/urpd-history.json:
 *   { edges:[n+1], weeks:[{ d, spot, pct:[n] }] }  (weeks is daily despite the name)
 */
export function rawBedrockSeries(history, { level = DEFAULT_LEVEL, minHistory = MIN_HISTORY } = {}) {
  const edges = history?.edges;
  const frames = (history?.weeks || []).filter(f => Array.isArray(f.pct) && f.spot > 0);
  if (!edges?.length || frames.length <= minHistory) return { level, minHistory, rows: [], loss: [] };

  const mids = midpoints(edges);
  const loss = frames.map(f => lossAtPrice(f.pct, mids, f.spot));

  const rows = [];
  for (let t = minHistory; t < frames.length; t++) {
    const prior = loss.slice(0, t).sort((a, b) => a - b);        // EXPANDING window, prior days only
    const threshold = percentile(prior, level);
    rows.push({
      d: frames[t].d,
      price: frames[t].spot,
      floor: priceForLoss(frames[t].pct, edges, threshold),
      threshold,
      loss: loss[t],
    });
  }
  return { level, minHistory, rows, loss };
}

/**
 * What the backtest actually shows — including the parts that undercut it. `inPlayPct` is the
 * point: a floor that spends its life far below price has not been tested, however many closes
 * "held" above it.
 */
export function bedrockVerdict(rows, { inPlayWithin = 25 } = {}) {
  const usable = rows.filter(r => r.floor > 0 && r.price > 0);
  if (!usable.length) return null;
  let held = 0, inPlay = 0, deepest = Infinity, deepestDate = null, firstInPlay = null;
  for (const r of usable) {
    const gap = (r.price / r.floor - 1) * 100;                   // % price sits above the floor
    if (gap >= 0) held++;
    if (gap <= inPlayWithin) { inPlay++; if (!firstInPlay) firstInPlay = r.d; }
    if (gap < deepest) { deepest = gap; deepestDate = r.d; }
  }
  const last = usable.at(-1);
  return {
    n: usable.length, held, heldPct: (held / usable.length) * 100,
    inPlay, inPlayPct: (inPlay / usable.length) * 100, firstInPlay, inPlayWithin,
    deepest, deepestDate,
    price: last.price, floor: last.floor, threshold: last.threshold, loss: last.loss,
    gap: (last.price / last.floor - 1) * 100,
    from: usable[0].d, to: last.d,
  };
}
