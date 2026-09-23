// ============================================================================
// LANDSCAPE EXPORT — the AEON Ledger: one file for members, one for everyone.
// ============================================================================
//   node research/pfp-forensics/landscape/export.mjs --results=r.jsonl --households=h.json \
//        --full=aeon-ledger.full.json --public=public/aeon-ledger.json
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

/** Build the full ledger document from phase-3 rows and the phase-2 households. Pure. */
export function buildLedger(rows, hh) {
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
      return {
        n: i + 1, verdict: p.verdict, walletCount: p.wallets, aeon: p.aeon || 0,
        bought: p.bought, sold: p.sold, rotated: p.rotated, received: p.received, movedOut: p.movedOut,
        holds: p.holds, boughtUsd: p.boughtUsd, soldUsd: p.soldUsd,
        firstBuy: ym(r.firstBuy), lastSell: ym(r.lastSell), years,
        wallets: r.wallets,
      };
    });
  const all = hh.households || [];
  return {
    updated: (hh.asOf || new Date().toISOString()).slice(0, 10),
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
    owners,
  };
}

/** The public copy: no wallet lists, per-owner figures rounded. Pure. */
export function publicLedger(full) {
  const R = ["bought", "sold", "rotated", "received", "movedOut", "holds", "boughtUsd", "soldUsd"];
  return {
    ...full,
    rounded: "per-owner figures rounded to 3 significant figures; totals exact",
    owners: full.owners.map(({ wallets, years, ...o }) => {
      const out = { ...o };
      for (const k of R) out[k] = sig3(o[k]);
      out.years = Object.fromEntries(Object.entries(years).map(([y, b]) =>
        [y, Object.fromEntries(Object.entries(b).map(([k, v]) => [k, sig3(v)]))]));
      return out;
    }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = readFileSync(arg("results"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  const hh = JSON.parse(readFileSync(arg("households"), "utf8"));
  const full = buildLedger(rows, hh);
  if (arg("full")) writeFileSync(arg("full"), JSON.stringify(full));
  const pub = publicLedger(full);
  if (JSON.stringify(pub).match(/0x[0-9a-f]{40}/i)) throw new Error("refusing to write: an address leaked into the public ledger");
  writeFileSync(arg("public"), JSON.stringify(pub));
  console.error(`aeon-ledger: ${full.owners.length} owners · ${full.scope.aeonHolders} AEON holders · as of ${full.updated}`);
}
