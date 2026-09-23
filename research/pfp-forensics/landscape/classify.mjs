// ============================================================================
// LANDSCAPE CLASSIFY — phase 3: every household's market record, and a reconciliation.
// ============================================================================
//   node research/pfp-forensics/landscape/classify.mjs --households=h.json --out=r.jsonl
//        --ledger=transfers.csv.gz,tail.csv --cache=dir [--conc=3]
//
// Reuses kol-cluster's tradeHistory UNCHANGED — the classifier that reproduces all four
// case studies, venue first and upgraded by transaction shape (RFQ sales, rotations) —
// fed through cached-fetch so the sweep is resumable and cannot truncate silently.
//
// GATE, per household: the ledger Blockscout returns must sum to the balance the archive
// holds, which was itself checked against balanceOf (200/200). A household that does not
// reconcile is recorded as failed, never classified: a missing page is missing trades.
//
// Biggest first, by SPX that ever passed through, so the SPX-weighted picture settles early.
// Results append to a JSONL; households already present are skipped on a rerun.
// ============================================================================
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { tradeHistory } from "../../../scripts/bot/kol-cluster.mjs";
import { buildModel, bandIndex } from "../../../src/models.js";
import { DEFAULT_RAW } from "../../../src/data.js";
import { loadLedger } from "./ledger.mjs";
import { cachedFetch, IMMUTABLE_ONLY } from "./cached-fetch.mjs";

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const ROOT = new URL("../../../", import.meta.url).pathname;

const px = JSON.parse(readFileSync(ROOT + "public/price-history.json", "utf8"));
const P = new Map(px.map(r => [r.date.slice(0, 10), r.price])), dl = [...P.keys()].sort();
const priceOn = d => P.get(d) ?? P.get(dl.filter(x => x <= d).pop());
const m = buildModel(DEFAULT_RAW), D0 = Date.parse("2023-08-17T00:00:00Z");
const dayN = ts => Math.round((Date.parse(ts.slice(0, 10) + "T00:00:00Z") - D0) / 864e5);

/** Everything the landscape needs from one household's classified rows. Pure. */
export function summarise(rows, balance) {
  const by = k => rows.filter(r => r.kind === k);
  const q = a => a.reduce((s, r) => s + r.qty, 0);
  const usd = a => a.reduce((s, r) => s + r.qty * (priceOn(r.ts.slice(0, 10)) || 0), 0);
  const hot = a => a.filter(r => { const p = priceOn(r.ts.slice(0, 10)); return p && bandIndex(m, p, dayN(r.ts)) >= 5; });
  // plain transfers net PER COUNTERPARTY: a round trip cancels, an unrelated receipt cannot
  // reduce what somebody else was sent (the lesson from #14's "moved on")
  const net = new Map();
  for (const r of rows) if (r.kind === "in" || r.kind === "out")
    net.set(r.cp, (net.get(r.cp) || 0) + (r.kind === "in" ? r.qty : -r.qty));
  const vals = [...net.values()];
  const B = by("buy"), S = by("sell"), R = by("rotation");
  const date = a => a.length ? a.map(r => r.ts).sort() : [];
  const bd = date(B), sd = date(S.concat(R));
  const ledgerSum = rows.reduce((s, r) => s + (r.dir === "IN" ? r.qty : -r.qty), 0);
  // Per calendar year, qty AND usd: SPX units alone let launch week dominate (tens of millions of
  // coins for a few thousand dollars in Aug 2023), so "who is selling NOW" needs its own split.
  const byYear = {};
  for (const r of rows) {
    const k = r.kind === "buy" ? "buy" : r.kind === "sell" || r.kind === "rotation" ? "sell" : null;
    if (!k) continue;
    const y = r.ts.slice(0, 4), b = byYear[y] ||= { buyQty: 0, buyUsd: 0, sellQty: 0, sellUsd: 0 };
    b[k + "Qty"] += r.qty; b[k + "Usd"] += r.qty * (priceOn(r.ts.slice(0, 10)) || 0);
  }
  return {
    buys: { n: B.length, qty: q(B), usd: usd(B), hotUsd: usd(hot(B)) },
    sells: { n: S.length, qty: q(S), usd: usd(S), hotUsd: usd(hot(S)) },
    rotation: { n: R.length, qty: q(R), usd: usd(R) },
    received: vals.filter(v => v > 0).reduce((a, b) => a + b, 0),
    movedOut: -vals.filter(v => v < 0).reduce((a, b) => a + b, 0),
    lpNet: q(by("lpIn")) - q(by("lpOut")),
    firstBuy: bd[0] || null, lastBuy: bd.at(-1) || null,
    firstSell: sd[0] || null, lastSell: sd.at(-1) || null,
    holds: balance, ledgerSum, reconciles: Math.abs(ledgerSum - balance) < 1, byYear,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const H = JSON.parse(readFileSync(arg("households"), "utf8")).households.filter(h => h.spxEver);
  const out = arg("out"), conc = Number(arg("conc", 3));
  const L = await loadLedger(arg("ledger").split(","));
  const flow = h => h.wallets.reduce((s, a) => s + L.ledger(a).filter(r => r.dir === "IN").reduce((x, r) => x + r.qty, 0), 0);
  const queue = H.map(h => ({ ...h, flow: flow(h) })).sort((a, b) => b.flow - a.flow);
  const done = new Set(existsSync(out) ? readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l).key) : []);
  const todo = queue.filter(h => !done.has(h.wallets[0]));
  // --fresh: a refresh run. Only immutable transaction pages come from the cache; every address
  // ledger is re-read, so it reconciles against today's balance.
  const fetchImpl = cachedFetch(arg("cache"), process.argv.includes("--fresh") ? { cacheable: IMMUTABLE_ONLY } : {});
  console.error(`${queue.length} households with SPX history · ${done.size} already done · ${todo.length} to go · concurrency ${conc}`);
  let i = 0, ok = 0, bad = 0;
  const worker = async () => {
    while (todo.length) {
      const h = todo.shift();
      const key = h.wallets[0];
      try {
        const rows = await tradeHistory(h.wallets, { fetchImpl });
        const bal = h.wallets.reduce((s, a) => s + L.balance(a), 0);
        const sum = summarise(rows, bal);
        appendFileSync(out, JSON.stringify({ key, wallets: h.wallets, aeonHolders: h.aeonHolders, aeon: h.aeon, flow: h.flow, ...sum }) + "\n");
        sum.reconciles ? ok++ : bad++;
      } catch (e) {
        appendFileSync(out, JSON.stringify({ key, wallets: h.wallets, aeonHolders: h.aeonHolders, aeon: h.aeon, flow: h.flow, failed: String(e.message).slice(0, 200) }) + "\n");
        bad++;
      }
      if (++i % 10 === 0) { const s = fetchImpl.stats(); console.error(`  ${i}/${queue.length - done.size} · reconciled ${ok} · failed ${bad} · cache ${s.hits} hit / ${s.misses} fetched`); }
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  console.error(`done · reconciled ${ok} · failed ${bad}`);
}
