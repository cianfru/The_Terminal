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
import { closeOn } from "./fx.mjs";

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const ROOT = new URL("../../../", import.meta.url).pathname;

const px = JSON.parse(readFileSync(ROOT + "public/price-history.json", "utf8"));
const P = new Map(px.map(r => [r.date.slice(0, 10), r.price])), dl = [...P.keys()].sort();
const priceOn = d => P.get(d) ?? P.get(dl.filter(x => x <= d).pop());
// daily ETH / BTC closes (fx.mjs), to price trades settled in them; without the file those fall back to the close
const FX = arg("fx") && existsSync(arg("fx")) ? JSON.parse(readFileSync(arg("fx"), "utf8")) : {};
const fxOn = { eth: closeOn(FX.eth), btc: closeOn(FX.btc) };

/**
 * What one buy or sell was worth in USD, and how we know. Pure; unit-tested.
 *   wallet  the money our wallets paid or received in that transaction (the owner's actual cost/proceeds)
 *   pool    our quantity at the price the SPX pools in that transaction traded at — for a trade paid in
 *           another token, or through a batch our wallets only settle with; also used when the wallet
 *           figure is more than 25% off the pool (an overpayment refunded as internal ETH, which we can't see)
 *   close   the day's SPX close — only when neither is readable, or a reading is over 3× off the close
 */
export function tradeValue(row, close, fx = fxOn) {
  const d = row.ts.slice(0, 10), c = row.qty * (close || 0);
  const usd = v => {
    if (!v) return null;
    if ((v.eth && !fx.eth(d)) || (v.btc && !fx.btc(d))) return null;
    const x = (v.usd || 0) + (v.eth || 0) * (v.eth ? fx.eth(d) : 0) + (v.btc || 0) * (v.btc ? fx.btc(d) : 0);
    return x > 0 ? x : null;
  };
  const sane = x => x != null && (!(c > 0) || (x / c > 1 / 3 && x / c < 3));
  const w = usd(row.value?.wallet), p = usd(row.value?.pool);
  if (sane(w) && (!sane(p) || (w / p > 0.8 && w / p < 1.25))) return { usd: w, via: "wallet" };
  if (sane(p)) return { usd: p, via: "pool" };
  return { usd: c, via: "close" };
}
const m = buildModel(DEFAULT_RAW), D0 = Date.parse("2023-08-17T00:00:00Z");
const dayN = ts => Math.round((Date.parse(ts.slice(0, 10) + "T00:00:00Z") - D0) / 864e5);

/** Everything the landscape needs from one household's classified rows. Pure. */
export function summarise(rows, balance) {
  const by = k => rows.filter(r => r.kind === k);
  const q = a => a.reduce((s, r) => s + r.qty, 0);
  // buys and sells at what changed hands (tradeValue); rotations and the rest at the day's close
  const val = new Map(rows.map(r => [r, r.kind === "buy" || r.kind === "sell" ? tradeValue(r, priceOn(r.ts.slice(0, 10)))
    : { usd: r.qty * (priceOn(r.ts.slice(0, 10)) || 0), via: "close" }]));
  const usd = a => a.reduce((s, r) => s + val.get(r).usd, 0);
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
    b[k + "Qty"] += r.qty; b[k + "Usd"] += val.get(r).usd;
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
    // every move in order, for the per-owner P&L and chart. Internal hops are already out.
    //   buy/sell      [time, kind, qty, usd, via]    usd = what changed hands (tradeValue)
    //   everything else [time, kind, qty, null, counterparty]  — the counterparty lets a round trip
    //                                                  (collateral, a pool, an exchange) come back at its cost
    trades: rows.filter(r => r.qty > 0 && ["buy", "sell", "rotation", "in", "out", "lpIn", "lpOut"].includes(r.kind))
      .map(r => r.kind === "buy" || r.kind === "sell"
        ? [r.ts, r.kind, +r.qty.toFixed(4), +val.get(r).usd.toFixed(2), val.get(r).via]
        : [r.ts, r.kind, +r.qty.toFixed(4), null, r.cp || null]),
    priced: { wallet: rows.filter(r => val.get(r).via === "wallet").length, pool: rows.filter(r => val.get(r).via === "pool").length,
      close: rows.filter(r => (r.kind === "buy" || r.kind === "sell") && val.get(r).via === "close").length },
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
