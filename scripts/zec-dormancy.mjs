// ============================================================================
// ZEC DORMANCY — did old coins move before the Sept-2025 runup?
// ============================================================================
//   node scripts/zec-dormancy.mjs
//
// Coin-days-destroyed per day for Zcash's full history, from Blockchair's block
// aggregation (keyless, one request), crossed against price and the shielding
// flow from build-zcash-veil.mjs.
//
// ⚠⚠ THE CONFOUND THAT DECIDES EVERY READ OF THIS METRIC: on Zcash, SHIELDING A
// COIN IS A SPEND. Moving t->z destroys the coin's accumulated coin-days exactly
// like selling does. So a CDD spike here is "old coins moved" and NOTHING more —
// it cannot separate an old whale distributing from an old whale going private,
// and after the coin shields it leaves every other metric too. Any narrative that
// reads a CDD spike as selling pressure is asserting something the data does not
// contain. This is why `sheldShare` is emitted alongside: it is the honest hedge.
//
// AND THE BASE RATE KILLS THE EASY STORY: CDD ran 3.8x baseline in Aug-2025, one
// month before a +82% move. It ALSO ran 5.2x in Mar-2025 and 4.3x in Apr-2025,
// and price fell after both. One hit, two misses — a coincidence with narrative
// appeal, not a signal. Report it with the misses attached or not at all.
// ============================================================================
import { pathToFileURL } from "node:url";

export const BASELINE_FROM = "2024-01-01", BASELINE_TO = "2025-06-30";

/** Median is the right baseline here — CDD is extremely heavy-tailed. */
export function median(xs) {
  const s = [...xs].filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Monthly CDD as a multiple of a per-day baseline, so months are comparable. */
export function monthlyMultiple(monthCdd, baselineDaily, daysInMonth = 30) {
  if (!(baselineDaily > 0)) return null;
  return Number((monthCdd / (baselineDaily * daysInMonth)).toFixed(2));
}

/**
 * How much of a period's dormancy could be shielding rather than selling.
 * Bounded to [0,1]; 1 means shielding alone could account for all of it.
 */
export function shieldShare(netShieldedZec, movedZec) {
  if (!(movedZec > 0)) return null;
  return Number(Math.min(1, Math.max(0, netShieldedZec / movedZec)).toFixed(3));
}

export function summarize(rows) {
  const base = rows.filter(r => r.d >= BASELINE_FROM && r.d <= BASELINE_TO).map(r => r.cdd);
  const b = median(base);
  return rows.map(r => ({ ...r, mult: b ? Number((r.cdd / b).toFixed(1)) : null }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log("Library module — see the header for the two caveats that govern any use of CDD on Zcash.");
}
