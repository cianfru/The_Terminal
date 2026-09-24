// ============================================================================
// LANDSCAPE — daily ETH and BTC closes in USD, to price trades at what actually changed hands.
// ============================================================================
//   node research/pfp-forensics/landscape/fx.mjs --out=fx.json [--since=2023-08-01]
//
// A trade settled in WETH/ETH (or WBTC) is worth that amount × the coin's close that day. Coinbase's public
// daily candles, no key; 300 days per request. Writes {eth: {day: close}, btc: {day: close}}.
// ============================================================================
import { writeFileSync } from "node:fs";

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const DAY = 864e5;

export async function dailyCloses(product, since, fetchImpl = fetch) {
  const out = {};
  for (let t = Date.parse(since); t < Date.now(); t += 299 * DAY) {
    const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400&start=${new Date(t).toISOString()}&end=${new Date(Math.min(Date.now(), t + 299 * DAY)).toISOString()}`;
    const r = await fetchImpl(url, { headers: { "user-agent": "spx6900-ledger" } });
    if (!r.ok) throw new Error(`${product} candles ${r.status}`);
    for (const [ts, , , , close] of await r.json()) out[new Date(ts * 1000).toISOString().slice(0, 10)] = close;   // [time, low, high, open, close, vol]
  }
  return out;
}

/** day → close, carrying the last known close forward. Pure. */
export function closeOn(series) {
  const days = Object.keys(series || {}).sort();
  return d => {
    if (series?.[d]) return series[d];
    let lo = 0, hi = days.length - 1, best = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (days[m] <= d) { best = series[days[m]]; lo = m + 1; } else hi = m - 1; }
    return best;
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const since = arg("since", "2023-08-01");
  const fx = { eth: await dailyCloses("ETH-USD", since), btc: await dailyCloses("BTC-USD", since) };
  writeFileSync(arg("out", "fx.json"), JSON.stringify(fx));
  console.log(`fx: ${Object.keys(fx.eth).length} ETH days · ${Object.keys(fx.btc).length} BTC days since ${since}`);
}
