// AEON Ledger P&L — ONE function, used by the pipeline (landscape/export.mjs) and the owner sheet's chart,
// so the row and the chart can never disagree. Pure; unit-tested (test/aeon-ledger-pos.test.mjs).
//
// An owner's trades, oldest first (landscape/classify.mjs):
//   [time, "buy" | "sell", qty, usd, via]         usd = what actually changed hands (via wallet | pool | close)
//   [time, kind, qty, null, key]                   every other move; key = who was on the other side
//
// KNOWN COST ONLY (owner, 2026-09-26: "not made up numbers"). Coins sit in two pools, and every move
// that takes coins out takes from both in proportion (average cost, extended to two pools):
//   KNOWN    coins bought: cost = what was actually paid
//   UNKNOWN  coins that arrived without a purchase from someone they were never sent to (a bridge, another
//            wallet, a gift). Their cost cannot be known, so they carry NO cost and NO P&L — they are
//            counted (`unknownHeld`) and said, never priced. (Pricing them at the day's close, the
//            previous rule, invented a cost: Owner #50 read $0.46, or $0.16, against $0.048 paid.)
//   buy                 KNOWN += qty at the price paid
//   sell / rotation     realized = the KNOWN share of the proceeds − its average cost; the unknown share of
//                       the proceeds is `proceedsUnknown`, no P&L (a rotation into another token at the close)
//   out / lpOut         leave both pools in proportion, nothing realized — REMEMBERED against their key
//   in / lpIn           coins coming back from a key they went to (collateral, a pool, the same exchange)
//                       return to the pools they left, at their cost; anything beyond that is UNKNOWN
// avgCost (cost of what is held) and unrealized cover the KNOWN coins only; avgBuy = average price of every buy; `costedBag` = how much of today's bag that is.
// Older 3-column rows ([time, kind, qty]) still replay, their buys and sells priced at the close.

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
  let kq = 0, kc = 0, uq = 0;                       // known qty + cost, unknown qty
  let realized = 0, invested = 0, boughtQty = 0, proceeds = 0, proceedsUnknown = 0, received = 0, receivedUnknown = 0, returned = 0, sentOut = 0;
  let lastBuy = null, lastSell = null;
  const buys = [], sells = [], parked = new Map();
  // take q coins out of both pools in proportion; returns what left each pool
  const take = q => {
    const tot = kq + uq, n = Math.min(q, tot);
    if (!(n > 0)) return { k: 0, c: 0, u: 0 };
    const k = n * (kq / tot), c = kq > 0 ? kc * (k / kq) : 0, u = n - k;
    kq -= k; kc -= c; uq -= u;
    return { k, c, u };
  };
  for (const [ts, kind, q, usd, key] of trades || []) {
    const t = Date.parse(ts), d = ts.slice(0, 10), close = priceOn(d) || 0;
    if (kind === "buy") {
      const v = usd ?? q * close;
      kq += q; kc += v; invested += v; boughtQty += q;
      buys.push([t, q > 0 ? v / q : close, q]); lastBuy = { d, qty: q, usd: v, price: q > 0 ? v / q : close };
    } else if (kind === "sell" || kind === "rotation") {
      const v = kind === "sell" ? usd ?? q * close : q * close, out = take(q);
      const vk = q > 0 ? v * (out.k / q) : 0, r = vk - out.c;
      realized += r; proceeds += v; proceedsUnknown += v - vk;
      sells.push([t, q > 0 ? v / q : close, q, r]); lastSell = { d, qty: q, usd: v, price: q > 0 ? v / q : close };
    } else if (kind === "out" || kind === "lpOut") {
      const out = take(q), rk = rtKey(kind, key); sentOut += q;
      if (rk) { const p = parked.get(rk) || { k: 0, c: 0, u: 0 }; p.k += out.k; p.c += out.c; p.u += out.u; parked.set(rk, p); }
    } else if (kind === "in" || kind === "lpIn") {
      const rk = rtKey(kind, key), p = rk && parked.get(rk), pt = p ? p.k + p.u : 0;
      const back = Math.min(q, pt);
      if (back > 0) {
        const f = back / pt, bk = p.k * f, bc = p.c * f, bu = p.u * f;
        p.k -= bk; p.c -= bc; p.u -= bu; kq += bk; kc += bc; uq += bu; returned += back;
      }
      uq += q - back; received += q; receivedUnknown += q - back;
    }
  }
  const bag = Math.max(0, holds || 0), avgCost = kq > 0 ? kc / kq : 0;
  const costedBag = kq + uq > 0 ? bag * (kq / (kq + uq)) : bag;
  // avgBuy = the average price of EVERY buy; avgCost = the cost of the coins still held (after selling cheap
  // coins and buying dearer ones the two differ — both true, both shown)
  return { bag, costedBag, unknownHeld: bag - costedBag, avgCost, avgBuy: boughtQty > 0 ? invested / boughtQty : 0, realized, unrealized: costedBag * (spot - avgCost),
    invested, proceeds, proceedsUnknown, lastBuy, lastSell, buys, sells, received, receivedUnknown, returned, sentOut };
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
