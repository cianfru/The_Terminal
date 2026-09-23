// SPX CITY — INTEL. The derived reads behind the City Intel page, kept pure so they are testable
// and so the page cannot quietly invent a number the rest of the site disagrees with.
//
// ⚠ TWO SOURCES, ONE RULE FOR USING THEM. The city has two honest descriptions of itself:
//
//   public/city-history.json  the canonical city series, replayed weekly from spx-timeline with
//                             residency approximated at "≥5,000 held ~13 weeks". Everything the
//                             City Growth chart and the citygrowth card say comes from here.
//   public/whales.json        today's roster with per-wallet holding age and 1d/7d/30d net flow.
//                             Its `days` is exact per-lot, so re-applying the residency rule to it
//                             gives ~2% fewer citizens than the history does.
//
// So: POPULATION, VALUE, GROWTH, ARRIVALS and VINTAGES all come from city-history — which makes
// this page agree with City Growth and the card by construction. whales.json is used ONLY for
// MOVEMENT (who is buying and selling), and that section reports no population of its own. Putting
// both counts on one page under the same word is exactly the contradiction the whale cards shipped.

export const TIER_LABELS = ["5k–25k", "25k–100k", "100k–250k", "250k–1M", "1M–5M", "5M+"];
// the same size boundaries as CITY_COHORTS, so the movement table lines up with the population one
export const TIER_BOUNDS = [[5e3, 25e3], [25e3, 1e5], [1e5, 25e4], [25e4, 1e6], [1e6, 5e6], [5e6, Infinity]];

const sum = (row, from, n) => { let s = 0; for (let i = from; i < from + n; i++) s += row[i] || 0; return s; };
const at = (rows, i) => rows[Math.max(0, Math.min(rows.length - 1, i))];

/** citizens / TVL for one daily row: [date, price, …6 counts, …6 token-or-usd values] */
export const citizensOf = row => sum(row, 2, 6);
export const tvlOf = row => sum(row, 8, 6);

/**
 * The page's headline reads, all from city-history.json.
 * @param hist public/city-history.json
 * @param circulating total tradable supply (1B − burn), for the "share of the token" line
 */
export function cityIntel(hist, { circulating = 0 } = {}) {
  const rows = hist?.rows;
  if (!Array.isArray(rows) || rows.length < 40) return null;
  const last = rows.at(-1), i = rows.length - 1;
  const price = last[1] || 0;
  const citizens = citizensOf(last), tvl = tvlOf(last);

  const back = (n, pick) => { const then = pick(at(rows, i - n)); const now = pick(last); return { now, then, d: now - then, pct: then ? ((now - then) / then) * 100 : 0 }; };

  const tiers = TIER_LABELS.map((label, k) => {
    const n = last[2 + k] || 0, v = last[8 + k] || 0;
    const prev = at(rows, i - 30);
    return {
      label, color: hist.colors?.[k], n, tvl: v,
      shareN: citizens ? (n / citizens) * 100 : 0,
      shareTvl: tvl ? (v / tvl) * 100 : 0,
      dN30: n - (prev[2 + k] || 0),
      dTvl30: v - (prev[8 + k] || 0),
    };
  });

  // arrivals / departures over the trailing 30 days (flow is [date, in, out] per period)
  const flow = Array.isArray(hist.flow) ? hist.flow : [];
  const recent = flow.slice(-30);
  const arrived = recent.reduce((a, r) => a + (r[1] || 0), 0);
  const left = recent.reduce((a, r) => a + (r[2] || 0), 0);

  const perCapita = Array.isArray(hist.perCapita) ? hist.perCapita : [];
  const medianHolding = perCapita.length ? perCapita.at(-1)[1] : null;

  // the city's tokens, so it can be stated against the token's own supply
  const tokens = price > 0 ? tvl / price : 0;

  return {
    date: last[0], price, citizens, tvl, tokens, medianHolding,
    shareOfCirculating: circulating > 0 && tokens > 0 ? (tokens / circulating) * 100 : null,
    citizens30: back(30, citizensOf), citizens365: back(365, citizensOf),
    tvl30: back(30, tvlOf), tvl365: back(365, tvlOf),
    arrived, left, netArrivals: arrived - left,
    tiers,
    series: rows.map(r => ({ ts: Date.parse(r[0]), citizens: citizensOf(r), tvl: tvlOf(r), price: r[1] })),
    flow: flow.map(r => ({ ts: Date.parse(r[0]), in: r[1] || 0, out: -(r[2] || 0), net: (r[1] || 0) - (r[2] || 0) })),
    vintages: (hist.vintages || []).filter(v => v.arrived >= 20),
    updated: hist.updated,
  };
}

/**
 * Who is actually moving, from whales.json. Reports flow only — never a population, because its
 * citizen count differs from the history's by construction (see the note at the top).
 * A wallet counts as buying or selling only if it moved more than 0.5% of its bag (min 1,000 SPX),
 * the project-wide dust rule, so this reconciles with the whale cards.
 */
export function cityMovement(whales, { window: win = "d30" } = {}) {
  const ws = whales?.wallets;
  if (!Array.isArray(ws) || !ws.length) return null;
  const dust = bal => Math.max(1000, (bal || 0) * 0.005);
  const tiers = TIER_BOUNDS.map(([lo, hi], k) => {
    const g = ws.filter(w => w.bal >= lo && w.bal < hi);
    let buy = 0, sell = 0, flat = 0, net = 0;
    for (const w of g) {
      const f = w[win] ?? w.d30 ?? 0;
      net += f;
      const d = dust(w.bal);
      if (f > d) buy++; else if (f < -d) sell++; else flat++;
    }
    const held = g.reduce((a, w) => a + w.bal, 0);
    return { label: TIER_LABELS[k], buy, sell, flat, net, held, moved: buy + sell, netPct: held ? (net / held) * 100 : 0 };
  });
  const tot = tiers.reduce((a, t) => ({
    buy: a.buy + t.buy, sell: a.sell + t.sell, flat: a.flat + t.flat, net: a.net + t.net, held: a.held + t.held,
  }), { buy: 0, sell: 0, flat: 0, net: 0, held: 0 });
  return { tiers, ...tot, tracked: ws.length, window: win, netPct: tot.held ? (tot.net / tot.held) * 100 : 0, updated: whales.updated };
}
