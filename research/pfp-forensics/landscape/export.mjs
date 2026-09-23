// ============================================================================
// LANDSCAPE EXPORT — the AEON Ledger: one file for members, one for everyone.
// ============================================================================
//   node research/pfp-forensics/landscape/export.mjs --results=r.jsonl --households=h.json \
//        --owners=aeon-owners.json --cex=cex-out.json --full=aeon-ledger.full.json --public=public/aeon-ledger.json
//
// The site's AEON Ledger (src/AeonLedger.jsx) reads this. Owner decision 2026-09-23: the NUMBERS are
// public, the ADDRESSES are for members (the same two-layer model as smart-money). So:
//   full    every owner with its wallet list → pushed to KV (push-private-feed.mjs, feed "aeon-ledger"),
//           served only to logged-in members via /api/auth?action=data&f=aeon-ledger. NEVER committed.
//   public  the same document with every wallet list removed and each owner's figures rounded to three
//           significant figures. Collection totals, years and verdict counts stay EXACT — those are the
//           findings, and they are what anyone can re-derive from the method and the chain.
//
// ⚠ Rounding is a courtesy, not anonymity. A determined reader can still match a large holding to the
// chain; the page says so. What the public layer does not do is hand anyone a list of addresses.
//
// Owners are numbered by what they hold TODAY (Owner #1 holds the most), so a refresh can renumber.
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";
import { aggregate } from "./report.mjs";

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;

/** Three significant figures, for per-owner figures in the public layer. Pure. */
export const sig3 = n => {
  if (!n || !isFinite(n)) return 0;
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(n))) - 2));
  return Math.round(n / p) * p;
};

const ym = ts => (ts ? ts.slice(0, 7) : null);

/**
 * Average-cost P&L in USD over one owner's trades, oldest first. Pure.
 *   buy / received / LP out-of-pool   acquire at that day's price (a received coin's true cost is unknown,
 *                                     so it enters at market — the same convention as the FIFO engine)
 *   sell / rotation                   realize proceeds − average cost of the coins sold
 *   moved out / into a pool           leave at average cost, nothing realized (a gift and an exchange
 *                                     deposit look the same on-chain, so no gain or loss is invented)
 * unrealized = what is held today × (spot − average cost).
 */
export function pnlOf(trades, priceOn, spot, holds) {
  let units = 0, cost = 0, realized = 0, invested = 0, proceeds = 0, lastBuy = null, lastSell = null;
  for (const [ts, k, q] of trades) {
    const p = priceOn(ts.slice(0, 10)) || 0;
    if (k === "buy" || k === "in" || k === "lpIn") {
      units += q; cost += q * p;
      if (k === "buy") { invested += q * p; lastBuy = { d: ts.slice(0, 10), qty: q, usd: q * p, price: p }; }
    } else if (k === "sell" || k === "rotation") {
      const avg = units > 0 ? cost / units : 0, take = Math.min(q, units);
      realized += q * p - take * avg; proceeds += q * p;
      cost -= take * avg; units -= take;
      lastSell = { d: ts.slice(0, 10), qty: q, usd: q * p, price: p };
    } else if (k === "out" || k === "lpOut") {
      const avg = units > 0 ? cost / units : 0, take = Math.min(q, units);
      cost -= take * avg; units -= take;
    }
  }
  const avgCost = units > 0 ? cost / units : 0;
  const h = Math.max(0, holds || 0);
  return { avgCost, realized, unrealized: h * spot - h * avgCost, invested, proceeds, lastBuy, lastSell };
}

/** Build the full ledger document from phase-3 rows and the phase-2 households. Pure. */
export function buildLedger(rows, hh, { tokenOwners = {}, rarity = [], priceOn = () => 0, spot = 0, cexOut = null } = {}) {
  const rank = new Map(rarity.map(t => [t.id, t.rank]));
  const img = new Map(rarity.map(t => [t.id, t.img]));
  const byWallet = new Map();
  for (const [id, a] of Object.entries(tokenOwners)) { if (!byWallet.has(a)) byWallet.set(a, []); byWallet.get(a).push(Number(id)); }
  const a = aggregate(rows);
  const byKey = new Map(rows.map(r => [r.key, r]));
  const holders = a.per.filter(p => p.holds >= 1).sort((x, y) => y.holds - x.holds);
  const share = k => {
    const s = holders.slice(0, k).reduce((t, p) => t + p.holds, 0);
    return a.totals.holds > 0 ? s / a.totals.holds : 0;
  };
  const owners = [...a.per]
    .sort((x, y) => y.holds - x.holds || y.bought - x.bought || (x.key < y.key ? -1 : 1))
    .map((p, i) => {
      const r = byKey.get(p.key);
      const years = {};
      for (const [y, b] of Object.entries(p.byYear || {}))
        years[y] = { buyQty: b.buyQty, buyUsd: b.buyUsd, sellQty: b.sellQty, sellUsd: b.sellUsd };
      const pieces = r.wallets.flatMap(w => byWallet.get(w) || []).map(id => [id, rank.get(id) ?? null])
        .sort((a, b) => (a[1] ?? 1e9) - (b[1] ?? 1e9) || a[0] - b[0]);
      const pfp = pieces.length ? { id: pieces[0][0], rank: pieces[0][1], img: img.get(pieces[0][0]) || null } : null;
      const pnl = pnlOf(r.trades || [], priceOn, spot, p.holds);
      const x = cexOut?.owners?.[p.key];
      const cex = x ? { sent: x.qty, sentUsd: x.usd, back: x.back, net: x.net, netUsd: x.netUsd, viaDeposit: x.viaDeposit,
        last: x.last, venues: x.venues } : null;
      return {
        n: i + 1, verdict: p.verdict, walletCount: p.wallets, aeon: Object.keys(tokenOwners).length ? pieces.length : (p.aeon || 0),
        pfp, pieces, pnl, cex, trades: r.trades || [],
        bought: p.bought, sold: p.sold, rotated: p.rotated, received: p.received, movedOut: p.movedOut,
        holds: p.holds, boughtUsd: p.boughtUsd, soldUsd: p.soldUsd,
        firstBuy: ym(r.firstBuy), lastSell: ym(r.lastSell), years,
        wallets: r.wallets,
      };
    });
  const all = hh.households || [];
  return {
    updated: (hh.asOf || new Date().toISOString()).slice(0, 10),
    spot,
    scope: {
      aeonHolders: all.reduce((s, h) => s + (h.aeonHolders?.length || 0), 0),
      households: all.length,
      neverTouchedSpx: all.filter(h => !h.spxEver).length,
      withSpx: a.totals.households + a.excluded.length,
      reconciled: a.totals.households,
      excluded: a.excluded.length,
    },
    totals: a.totals,
    years: a.years,
    byVerdict: a.byVerdict,
    sellersFor80pct: a.sellersFor80pct,
    holding: { owners: holders.length, top1: share(1), top5: share(5), top10: share(10), top25: share(25), top50: share(50) },
    cex: cexOut ? cexTotals(owners, cexOut) : null,
    owners,
  };
}

/** Collection-wide exchange flows (cex-out.mjs): exact, like every other total. Pure. */
function cexTotals(owners, cexOut) {
  const t = { owners: 0, sent: 0, sentUsd: 0, back: 0, net: 0, netUsd: 0, viaDeposit: 0, venues: {},
    exchanges: cexOut.exchanges || 0, deposits: cexOut.deposits || 0 };
  for (const o of owners) {
    if (!o.cex) continue;
    t.owners++;
    for (const k of ["sent", "sentUsd", "back", "net", "netUsd", "viaDeposit"]) t[k] += o.cex[k] || 0;
    for (const [v, q] of Object.entries(o.cex.venues || {})) t.venues[v] = (t.venues[v] || 0) + q;
  }
  return t;
}

/** How many owners the public page lists (owner decision 2026-09-23); the rest are for members. */
export const PUBLIC_OWNERS = 10;

/**
 * The public copy: the top PUBLIC_OWNERS owners only, no wallet lists, per-owner figures rounded. Pure.
 * The rest are left OUT of the file, not hidden by the page: each owner's AEON pieces point at its wallet
 * through the token's owner, so a list rendered from a public file would be public whatever the page did.
 * Totals, years, verdict counts and concentration stay computed over EVERY owner.
 */
export function publicLedger(full, limit = PUBLIC_OWNERS) {
  const R = ["bought", "sold", "rotated", "received", "movedOut", "holds", "boughtUsd", "soldUsd"];
  return {
    ...full,
    rounded: "per-owner figures rounded to 3 significant figures; totals exact",
    ownersTotal: full.owners.length,
    owners: full.owners.slice(0, limit).map(({ wallets, years, trades, pnl, cex, ...o }) => {
      const out = { ...o };
      for (const k of R) out[k] = sig3(o[k]);
      const leg = x => (x ? { d: x.d, qty: sig3(x.qty), usd: sig3(x.usd) } : null);
      out.pnl = { avgCost: +pnl.avgCost.toPrecision(3), realized: sig3(pnl.realized), unrealized: sig3(pnl.unrealized),
        invested: sig3(pnl.invested), proceeds: sig3(pnl.proceeds), lastBuy: leg(pnl.lastBuy), lastSell: leg(pnl.lastSell) };
      out.cex = cex ? { sent: sig3(cex.sent), sentUsd: sig3(cex.sentUsd), back: sig3(cex.back), net: sig3(cex.net),
        netUsd: sig3(cex.netUsd), last: cex.last, venues: Object.fromEntries(Object.entries(cex.venues || {}).map(([v, q]) => [v, sig3(q)])) } : null;
      out.years = Object.fromEntries(Object.entries(years).map(([y, b]) =>
        [y, Object.fromEntries(Object.entries(b).map(([k, v]) => [k, sig3(v)]))]));
      return out;
    }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = readFileSync(arg("results"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  const hh = JSON.parse(readFileSync(arg("households"), "utf8"));
  const tokenOwners = arg("owners") ? JSON.parse(readFileSync(arg("owners"), "utf8")).owners : {};
  const rarity = JSON.parse(readFileSync(arg("rarity", "public/aeon-rarity.json"), "utf8")).tokens || [];
  const px = JSON.parse(readFileSync(arg("prices", "public/price-history.json"), "utf8"));
  const P = new Map(px.map(r => [r.date.slice(0, 10), r.price])), days = [...P.keys()].sort();
  const priceOn = d => P.get(d) ?? P.get(days.filter(x => x <= d).pop()) ?? 0;
  const spot = P.get(days.at(-1));
  const cexOut = arg("cex") ? JSON.parse(readFileSync(arg("cex"), "utf8")) : null;
  const full = buildLedger(rows, hh, { tokenOwners, rarity, priceOn, spot, cexOut });
  if (arg("full")) writeFileSync(arg("full"), JSON.stringify(full));
  const pub = publicLedger(full);
  if (JSON.stringify(pub).match(/0x[0-9a-f]{40}/i)) throw new Error("refusing to write: an address leaked into the public ledger");
  writeFileSync(arg("public"), JSON.stringify(pub));
  console.error(`aeon-ledger: ${full.owners.length} owners · ${full.scope.aeonHolders} AEON holders · as of ${full.updated}`);
}
