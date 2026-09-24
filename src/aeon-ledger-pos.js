// AEON Ledger P&L — ONE function, used by the pipeline (landscape/export.mjs) and the owner sheet's chart,
// so the row and the chart can never disagree. Pure; unit-tested (test/aeon-ledger-pos.test.mjs).
//
// An owner's trades, oldest first (landscape/classify.mjs):
//   [time, "buy" | "sell", qty, usd, via]         usd = what actually changed hands (via wallet | pool | close)
//   [time, kind, qty, null, key]                   every other move; key = who was on the other side
// Average cost, with ROUND TRIPS kept at their cost (owner, 2026-09-24: "as close as possible to real P&L"):
//   buy                 acquire at the price paid
//   sell                realize the money received − average cost
//   rotation            SPX swapped into another token: realized at the day's close (nothing came back as money)
//   out / lpOut         leave at average cost, nothing realized — and are REMEMBERED against their key
//   in / lpIn           coins coming back from a key they went to (loan collateral, a liquidity pool, the same
//                       exchange) return at the cost they left with; anything beyond that is a new receipt,
//                       whose true cost is unknowable, entered at the day's close and counted in `receivedAtMarket`
// Older 3-column rows ([time, kind, qty]) still replay, priced at the close.

/** Day → price lookup over the price-history array [{date, price}], carrying the last known close forward. */
export function priceLookup(px) {
  const rows = (px || []).filter(r => r && r.date && r.price > 0).map(r => [r.date.slice(0, 10), r.price]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const m = new Map(rows);
  return d => {
    if (m.has(d)) return m.get(d);
    let lo = 0, hi = rows.length - 1, best = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (rows[mid][0] <= d) { best = rows[mid][1]; lo = mid + 1; } else hi = mid - 1; }
    return best;
  };
}

/** The key a move is matched on: every liquidity move is one pool of coins, the rest by counterparty. */
const rtKey = (k, key) => (k === "lpIn" || k === "lpOut" ? "lp" : key || null);

export function positionFromTrades(trades, priceOn, holds, spot = 0) {
  let units = 0, cost = 0, realized = 0, invested = 0, proceeds = 0, received = 0, receivedAtMarket = 0, returned = 0, sentOut = 0;
  let lastBuy = null, lastSell = null;
  const buys = [], sells = [], parked = new Map();
  const leave = q => { const avg = units > 0 ? cost / units : 0, take = Math.min(q, units); cost -= take * avg; units -= take; return take * avg; };
  for (const [ts, k, q, usd, key] of trades || []) {
    const t = Date.parse(ts), d = ts.slice(0, 10), close = priceOn(d) || 0;
    if (k === "buy") {
      const v = usd ?? q * close;
      units += q; cost += v; invested += v;
      buys.push([t, q > 0 ? v / q : close, q]); lastBuy = { d, qty: q, usd: v, price: q > 0 ? v / q : close };
    } else if (k === "sell" || k === "rotation") {
      const v = k === "sell" ? usd ?? q * close : q * close, c = leave(q), r = v - c;
      realized += r; proceeds += v;
      sells.push([t, q > 0 ? v / q : close, q, r]); lastSell = { d, qty: q, usd: v, price: q > 0 ? v / q : close };
    } else if (k === "out" || k === "lpOut") {
      const c = leave(q), rk = rtKey(k, key); sentOut += q;
      if (rk) { const p = parked.get(rk) || { q: 0, c: 0 }; p.q += q; p.c += c; parked.set(rk, p); }
    } else if (k === "in" || k === "lpIn") {
      const rk = rtKey(k, key), p = rk && parked.get(rk);
      const back = p ? Math.min(q, p.q) : 0, backCost = back > 0 ? (p.c * back) / p.q : 0;
      if (back > 0) { p.q -= back; p.c -= backCost; returned += back; }
      units += q; cost += backCost + (q - back) * close; received += q; receivedAtMarket += q - back;
    }
  }
  const bag = Math.max(0, holds || 0), avgCost = units > 0 ? cost / units : 0;
  return { bag, avgCost, realized, unrealized: bag * (spot - avgCost), invested, proceeds, lastBuy, lastSell,
    buys, sells, received, receivedAtMarket, returned, sentOut };
}

/** Alchemy's CDN serves the full render (~0.5 MB); its image service has a ~50 KB thumbnail of the same file. */
export function aeonThumb(img) {
  const m = /nft2?-cdn\.alchemy\.com\/eth-mainnet\/([0-9a-f]{32})/.exec(img || "");
  return m ? `https://res.cloudinary.com/alchemyapi/image/upload/thumbnailv2/eth-mainnet/${m[1]}` : img || null;
}

export const AEON_CONTRACT = "0xc374a204334d4edd4c6a62f0867c752d65e9579c";
export const openseaUrl = id => `https://opensea.io/assets/ethereum/${AEON_CONTRACT}/${id}`;

const recent = o => [o.pnl?.lastBuy?.d, o.pnl?.lastSell?.d].filter(Boolean).sort().pop() || "";
/** Sort keys for the owner list: [id, label, value]. Largest first. */
export const OWNER_SORTS = [
  ["holds", "SPX held", o => o.holds],
  ["realized", "Realized P&L", o => o.pnl?.realized || 0],
  ["unrealized", "Unrealized P&L", o => o.pnl?.unrealized || 0],
  ["aeon", "Most AEON", o => o.aeon || 0],
  ["cex", "To exchanges", o => o.cex?.net || 0],
  ["recent", "Latest trade", o => Date.parse(recent(o) || "1970-01-01")],
];
