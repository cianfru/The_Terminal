// ============================================================================
// LANDSCAPE EXPORT — the AEON Ledger, fully public.
// ============================================================================
//   node research/pfp-forensics/landscape/export.mjs --results=r.jsonl --households=h.json \
//        --owners=aeon-owners.json --cex=cex-out.json --public=public/aeon-ledger.json \
//        --trades=public/aeon-ledger-trades.json [--full=aeon-ledger.full.json]
//
// The site's AEON Ledger (src/AeonLedger.jsx) reads this. Owner decision 2026-09-23 (final): EVERYTHING
// PUBLIC — every owner, their wallets, figures and trade history. It is public chain data; the ledger only
// reconstructs it (an earlier same-day version kept addresses and all but the top 10 for members).
//   public   every owner with wallets, pieces, P&L, exchange flows; per-owner figures tidied, totals exact
//   trades   owner number → trade list, a separate file so the list page loads light on a phone
//
// Owners are numbered by what they hold TODAY (Owner #1 holds the most), so a refresh can renumber.
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";
import { aggregate } from "./report.mjs";
import { cexWallets } from "./cex-out.mjs";
import { positionFromTrades } from "../../../src/aeon-ledger-pos.js";

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;

/** Three significant figures, for per-owner figures in the public layer. Pure. */
export const sig3 = n => {
  if (!n || !isFinite(n)) return 0;
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(n))) - 2));
  return Math.round(n / p) * p;
};

const ym = ts => (ts ? ts.slice(0, 7) : null);

/**
 * An owner's P&L in USD. The replay itself lives in src/aeon-ledger-pos.js (positionFromTrades) — ONE
 * function for this file and the owner sheet's chart. Buys and sells at what actually changed hands,
 * round trips (collateral, liquidity, the same exchange) back at their cost, and coins that arrived with no
 * known cost kept OUT of the P&L (counted in unknownHeld, never priced).
 */
export function pnlOf(trades, priceOn, spot, holds) {
  const p = positionFromTrades(trades, priceOn, holds, spot);
  return { avgCost: p.avgCost, avgBuy: p.avgBuy, realized: p.realized, unrealized: p.unrealized, invested: p.invested, proceeds: p.proceeds,
    lastBuy: p.lastBuy, lastSell: p.lastSell, costedBag: p.costedBag, unknownHeld: p.unknownHeld,
    receivedUnknown: p.receivedUnknown, proceedsUnknown: p.proceedsUnknown, returned: p.returned };
}

/**
 * Counterparty → the key a round trip is matched on. Pure.
 * An exchange is ONE key per venue: coins go in through a deposit address and come back from a hot wallet.
 * Everything else keeps its address, shortened to 10 characters for the published file.
 */
export function keyer(cex = new Map(), depositVenue = {}) {
  return cp => {
    if (!cp) return null;
    const a = cp.toLowerCase(), v = cex.get(a) || depositVenue[a];
    return v ? "x:" + v : a.slice(0, 10);
  };
}
/** Trades with counterparties turned into matching keys (buys and sells keep their pricing source). Pure. */
export const keyTrades = (trades, key) => (trades || []).map(t => (t[1] === "buy" || t[1] === "sell" || t.length < 5 ? t : [t[0], t[1], t[2], null, key(t[4])]));

/** Build the full ledger document from phase-3 rows and the phase-2 households. Pure. */
export function buildLedger(rows, hh, { tokenOwners = {}, rarity = [], priceOn = () => 0, spot = 0, cexOut = null, cex = new Map() } = {}) {
  const key = keyer(cex, cexOut?.depositVenue || {});
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
      const trades = keyTrades(r.trades, key);
      const pnl = pnlOf(trades, priceOn, spot, p.holds);
      const x = cexOut?.owners?.[p.key];
      const cex = x ? { sent: x.qty, sentUsd: x.usd, back: x.back, net: x.net, netUsd: x.netUsd, viaDeposit: x.viaDeposit,
        last: x.last, venues: x.venues } : null;
      return {
        n: i + 1, verdict: p.verdict, walletCount: p.wallets, aeon: Object.keys(tokenOwners).length ? pieces.length : (p.aeon || 0),
        pfp, pieces, pnl, cex, trades, priced: r.priced || null,
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
    // how every buy and sell was valued (classify.mjs tradeValue): the money our wallets moved, the price the
    // SPX pools traded at in that transaction, or — only when neither is readable — the day's close
    pricing: owners.reduce((t, o) => { for (const k of ["wallet", "pool", "close"]) t[k] += o.priced?.[k] || 0; return t; }, { wallet: 0, pool: 0, close: 0 }),
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

/** Round a figure for the published file: whole units above 100, 4 significant figures below. Pure.
 *  Keeps the files small without moving any number a reader could check (totals stay exact). */
const tidy = v => (typeof v !== "number" || !isFinite(v) || Number.isInteger(v) ? v : Math.abs(v) >= 100 ? Math.round(v) : +v.toPrecision(4));
const tidyAll = x => JSON.parse(JSON.stringify(x, (k, v) => (k === "" ? v : tidy(v))));

/**
 * The published ledger (owner decision 2026-09-23, second call: "remove all restrictions, make the full list
 * fully public" — it is public chain data, the ledger only puts it together). Two files:
 *   ledger   every owner, with wallets and figures; totals EXACT, per-owner figures tidied (tidy())
 *   trades   owner number → [[time, kind, qty]], loaded only when someone opens an owner's chart
 */
export function publicLedger(full) {
  return { ...full, owners: tidyAll(full.owners.map(({ trades, priced, ...o }) => o)) };
}
export function publicTrades(full) {
  return { updated: full.updated, owners: Object.fromEntries(full.owners.map(o => [o.n, o.trades || []])) };
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
  const full = buildLedger(rows, hh, { tokenOwners, rarity, priceOn, spot, cexOut, cex: cexWallets() });
  if (arg("full")) writeFileSync(arg("full"), JSON.stringify(full));
  writeFileSync(arg("public"), JSON.stringify(publicLedger(full)));
  writeFileSync(arg("trades", "public/aeon-ledger-trades.json"), JSON.stringify(publicTrades(full)));
  console.error(`aeon-ledger: ${full.owners.length} owners · ${full.scope.aeonHolders} AEON holders · as of ${full.updated}`);
}
