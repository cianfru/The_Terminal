// AEON Ledger → the shape PositionDetail draws. Pure, shared by the owner sheet and its test.
//
// An owner's members-file `trades` are [[isoTs, kind, qty]] oldest first (landscape/classify.mjs). The
// replay is the SAME average-cost rule as landscape/export.mjs pnlOf, so the sheet's realized figure
// matches the row it was opened from:
//   buy / in / lpIn        acquire at that day's price (only a BUY is drawn as an orb — a receipt isn't a purchase)
//   sell / rotation        realize proceeds − average cost (drawn as a sell triangle)
//   out / lpOut            leave at average cost, nothing realized, not drawn

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

export function positionFromTrades(trades, priceOn, holds) {
  let units = 0, cost = 0, realized = 0, received = 0, sentOut = 0;
  const buys = [], sells = [];
  for (const [ts, k, q] of trades || []) {
    const t = Date.parse(ts), p = priceOn(ts.slice(0, 10)) || 0;
    if (k === "buy" || k === "in" || k === "lpIn") {
      units += q; cost += q * p;
      if (k === "buy") buys.push([t, p, q]); else received += q;
    } else if (k === "sell" || k === "rotation") {
      const avg = units > 0 ? cost / units : 0, take = Math.min(q, units), r = q * p - take * avg;
      realized += r; cost -= take * avg; units -= take;
      sells.push([t, p, q, r]);
    } else if (k === "out" || k === "lpOut") {
      const avg = units > 0 ? cost / units : 0, take = Math.min(q, units);
      cost -= take * avg; units -= take; sentOut += q;
    }
  }
  return { bag: Math.max(0, holds || 0), avgCost: units > 0 ? cost / units : 0, realized, buys, sells, received, sentOut };
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
