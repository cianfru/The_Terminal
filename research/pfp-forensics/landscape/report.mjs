// ============================================================================
// LANDSCAPE REPORT — phase 4: across every AEON household, is the SPX being held or sold?
// ============================================================================
//   node research/pfp-forensics/landscape/report.mjs --results=r.jsonl [--out=report.json]
//
// Measured by QUANTITY, never by trade count (owner: "buys outgrew the sales by a certain order of
// magnitude" is a statement about coins, and one 2M sale outweighs forty small buys). Only households
// whose ledger reconciled to the chain are counted; the rest are listed as excluded, never guessed.
//
// Four flows per household, each from phase 3's classifier:
//   bought    SPX in through a venue (pool/router, or an RFQ/unwrap shape)
//   sold      SPX out through a venue
//   rotated   SPX out with another token back — a sale into something else, counted as selling
//   received / movedOut   plain transfers, netted PER COUNTERPARTY (not trades: gifts, OTC, hops
//             to wallets outside the household). Reported separately, never folded into buy/sell.
//
// Verdicts are about BEHAVIOUR, not identity, and are exhaustive:
//   never-sold     sold + rotated = 0 (includes wallets that only received)
//   holding        still holds ≥ 50% of everything that came in
//   trimming       holds something, but less than half of what came in
//   exited         holds < 1 SPX today
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;

/** One household's flows and verdict. Pure. */
export function verdict(r) {
  const bought = r.buys?.qty || 0, sold = r.sells?.qty || 0, rotated = r.rotation?.qty || 0;
  const received = r.received || 0, movedOut = r.movedOut || 0, holds = Math.max(0, r.holds || 0);
  const cameIn = bought + received;
  const soldAll = sold + rotated;
  let v;
  if (holds < 1) v = "exited";
  else if (soldAll === 0) v = "never-sold";
  else if (cameIn > 0 && holds >= 0.5 * cameIn) v = "holding";
  else v = "trimming";
  const boughtUsd = r.buys?.usd || 0, soldUsd = (r.sells?.usd || 0) + (r.rotation?.usd || 0);
  return { bought, sold, rotated, received, movedOut, holds, cameIn, soldAll, boughtUsd, soldUsd, byYear: r.byYear || {},
    heldShare: cameIn > 0 ? Math.min(1, holds / cameIn) : null,
    buySellRatio: soldAll > 0 ? bought / soldAll : null, verdict: v };
}

/** Collection-wide totals by quantity. Pure. */
export function aggregate(rows) {
  const ok = rows.filter(r => !r.failed && r.reconciles);
  const excluded = rows.filter(r => r.failed || !r.reconciles).map(r => ({ key: r.key, why: r.failed || "did not reconcile" }));
  const per = ok.map(r => ({ key: r.key, wallets: r.wallets.length, aeon: r.aeon, ...verdict(r) }));
  const sum = k => per.reduce((a, p) => a + p[k], 0);
  const byVerdict = {};
  for (const p of per) {
    const b = byVerdict[p.verdict] ||= { households: 0, bought: 0, soldAll: 0, holds: 0 };
    b.households++; b.bought += p.bought; b.soldAll += p.soldAll; b.holds += p.holds;
  }
  const totals = { households: per.length, bought: sum("bought"), sold: sum("sold"), rotated: sum("rotated"),
    received: sum("received"), movedOut: sum("movedOut"), holds: sum("holds") };
  totals.soldAll = totals.sold + totals.rotated;
  totals.boughtUsd = sum("boughtUsd"); totals.soldUsd = sum("soldUsd");
  // year by year, qty and usd — launch week buys tens of millions of coins for pocket change, so
  // "who is selling now" is only answerable per period
  const years = {};
  for (const p of per) for (const [y, b] of Object.entries(p.byYear)) {
    const t = years[y] ||= { buyQty: 0, buyUsd: 0, sellQty: 0, sellUsd: 0, buyers: 0, sellers: 0 };
    t.buyQty += b.buyQty; t.buyUsd += b.buyUsd; t.sellQty += b.sellQty; t.sellUsd += b.sellUsd;
    if (b.buyQty > 0) t.buyers++; if (b.sellQty > 0) t.sellers++;
  }
  totals.buySellRatio = totals.soldAll > 0 ? totals.bought / totals.soldAll : null;
  // concentration of the selling: how few households account for most of it
  const bySold = [...per].sort((a, b) => b.soldAll - a.soldAll);
  let run = 0, n80 = 0;
  for (const p of bySold) { if (run >= 0.8 * totals.soldAll) break; run += p.soldAll; n80++; }
  return { totals, years, byVerdict, sellersFor80pct: n80, topSellers: bySold.slice(0, 15), excluded, per };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = readFileSync(arg("results"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  const a = aggregate(rows);
  const f = n => Math.round(n).toLocaleString("en-US");
  const t = a.totals;
  console.log(`${t.households} reconciled households · ${a.excluded.length} excluded`);
  console.log(`bought ${f(t.bought)} · sold ${f(t.sold)} · rotated ${f(t.rotated)} · received ${f(t.received)} · moved out ${f(t.movedOut)} · holds ${f(t.holds)}`);
  console.log(`bought ÷ (sold + rotated) = ${t.buySellRatio?.toFixed(2)} by SPX · $${f(t.boughtUsd)} bought vs $${f(t.soldUsd)} sold`);
  for (const [y, b] of Object.entries(a.years).sort())
    console.log(`  ${y}  buy ${f(b.buyQty).padStart(12)} SPX $${f(b.buyUsd).padStart(11)} (${b.buyers} hh) · sell ${f(b.sellQty).padStart(12)} SPX $${f(b.sellUsd).padStart(11)} (${b.sellers} hh)`);
  for (const [k, b] of Object.entries(a.byVerdict))
    console.log(`  ${k.padEnd(11)} ${String(b.households).padStart(4)} households · bought ${f(b.bought)} · sold ${f(b.soldAll)} · hold ${f(b.holds)}`);
  console.log(`${a.sellersFor80pct} households account for 80% of all SPX sold`);
  if (arg("out")) writeFileSync(arg("out"), JSON.stringify(a, null, 1));
}
