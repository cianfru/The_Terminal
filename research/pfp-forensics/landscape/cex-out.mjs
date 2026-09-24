// ============================================================================
// LANDSCAPE — SPX each AEON owner sent to an EXCHANGE (owner idea, 2026-09-23).
// ============================================================================
//   node research/pfp-forensics/landscape/cex-out.mjs --results=r.jsonl --transfers=transfers.csv[.gz] \
//        [--tail=tail.csv] [--prices=public/price-history.json] --out=cex-out.json
//
// The ledger counts a SALE only when SPX goes through a DEX pool or router. Selling on an exchange starts
// with a plain transfer, so until now those coins sat in "moved out" with gifts and wallet moves. We tag
// the exchanges' own wallets (EXCLUDE_LABELS kind "cex"), so a transfer INTO one is exchange-bound.
//
// People rarely send to the hot wallet itself: each user gets a DEPOSIT ADDRESS the exchange later sweeps.
// So an untagged address counts as a deposit address when it passed on essentially everything it got,
// and to tagged exchange wallets: ≥90% of what it sent went to them, what it sent is ≥90% of what it
// received, and it holds under 1% of what it received. Household wallets never qualify (a move between an
// owner's own wallets is not a deposit). This is INFERRED — stated as such wherever it is shown.
//
// "Sent to an exchange" is NOT counted as sold: a deposit can sit on the exchange, go to a friend, or come
// back. It is its own figure next to DEX sales: likely sold, never proven.
// ============================================================================
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { EXCLUDE_LABELS, canonVenue } from "../../../scripts/build-onchain-local.mjs";

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const DEC = 1e8;

/** Exchange wallets → venue, from the one tag list the whole site uses. Pure.
 *  The list files market makers and an MEV bot under "cex" (liquidity, for the supply charts); they are not
 *  exchanges a holder deposits to — SPX sent to them is a trade the classifier already counts — so they're out. */
export const NOT_AN_EXCHANGE = /wintermute|market maker|mev/i;
export function cexWallets(labels = EXCLUDE_LABELS) {
  const m = new Map();
  for (const [a, l] of Object.entries(labels))
    if (l.kind === "cex" && !NOT_AN_EXCHANGE.test(l.name)) m.set(a.toLowerCase(), canonVenue(l.name));
  return m;
}

/** Per-address totals needed to spot deposit addresses. Feed it every transfer. */
export function depositTracker(cex) {
  const st = new Map();
  const get = a => { let s = st.get(a); if (!s) st.set(a, s = { recv: 0, sent: 0, toCex: 0, venue: new Map() }); return s; };
  return {
    add(from, to, q) {
      if (!cex.has(from)) get(from).sent += q;
      if (!cex.has(to)) get(to).recv += q;
      if (cex.has(to) && !cex.has(from)) {
        const s = get(from); s.toCex += q; const v = cex.get(to); s.venue.set(v, (s.venue.get(v) || 0) + q);
      }
    },
    /** address → venue for every inferred deposit address. `exclude` = wallets that can never be one. */
    deposits(exclude = new Set(), labels = EXCLUDE_LABELS) {
      const out = new Map();
      for (const [a, s] of st) {
        if (exclude.has(a) || labels[a] || s.sent <= 0 || s.recv <= 0) continue;
        if (s.toCex < 0.9 * s.sent || s.sent < 0.9 * s.recv || s.recv - s.sent > 0.01 * s.recv) continue;
        out.set(a, [...s.venue].sort((x, y) => y[1] - x[1])[0][0]);
      }
      return out;
    },
  };
}

/**
 * Each owner's SPX to and from exchanges. `owners` = [{key, wallets}]. Pure over the transfers given.
 *   sent   to a tagged exchange wallet or an inferred deposit address
 *   back   withdrawn from a tagged exchange wallet (withdrawals come from the hot wallet itself)
 *   net    sent − back, floored at 0: SPX deposited and later withdrawn was not sold
 * `isSale(key, ts)` lets the caller skip a transfer the classifier already counted as a sale.
 */
export function ownerCexOut(transfers, owners, cex, deposits, priceOn = () => 0, isSale = () => false) {
  const who = new Map();
  for (const o of owners) for (const w of o.wallets) who.set(w, o.key);
  const res = {};
  const at = k => res[k] || (res[k] = { qty: 0, usd: 0, n: 0, direct: 0, viaDeposit: 0, back: 0, backUsd: 0, first: null, last: null, venues: {} });
  for (const [from, to, q, ts] of transfers) {
    const d = ts.slice(0, 10), usd = q * (priceOn(d) || 0);
    const kIn = who.get(to);
    if (kIn && cex.has(from)) { const r = at(kIn); r.back += q; r.backUsd += usd; continue; }
    const k = who.get(from);
    if (!k || kIn === k) continue;
    const direct = cex.get(to), venue = direct || deposits.get(to);
    if (!venue || isSale(k, ts)) continue;
    const r = at(k);
    r.qty += q; r.usd += usd; r.n++;
    if (direct) r.direct += q; else r.viaDeposit += q;
    if (!r.first || d < r.first) r.first = d; if (!r.last || d > r.last) r.last = d;
    r.venues[venue] = (r.venues[venue] || 0) + q;
  }
  for (const [k, r] of Object.entries(res)) {
    if (!r.n) { delete res[k]; continue; }   // only withdrew: nothing sent to an exchange
    r.net = Math.max(0, r.qty - r.back); r.netUsd = Math.max(0, r.usd - r.backUsd);
  }
  return res;
}

async function* rowsOf(path) {
  if (!path) return;
  const input = path.endsWith(".gz") ? createReadStream(path).pipe(createGunzip()) : createReadStream(path);
  let idx = null;
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!line) continue;
    const c = line.split(",");
    if (!idx) { const h = c.map(x => x.trim().toLowerCase()); idx = ["sender", "receiver", "time", "value"].map(n => h.indexOf(n)); continue; }
    yield [c[idx[0]].toLowerCase(), c[idx[1]].toLowerCase(), Number(c[idx[3]]) / DEC, c[idx[2]].replace(" ", "T")];
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = readFileSync(arg("results"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  const sales = new Set();
  for (const r of results) for (const [ts, k] of r.trades || []) if (k === "sell" || k === "rotation") sales.add(r.key + "|" + ts.slice(0, 19));
  const owners = results.filter(r => r.reconciles).map(r => ({ key: r.key, wallets: r.wallets.map(w => w.toLowerCase()) }));
  const own = new Set(owners.flatMap(o => o.wallets));
  const cex = cexWallets();
  const tr = depositTracker(cex);
  const mine = [];   // only transfers sent BY an owner are kept for the second step
  const seen = new Set();
  for (const src of [arg("transfers"), arg("tail")]) {
    for await (const t of rowsOf(src)) {
      const id = t.join("|");
      if (src === arg("tail")) { if (seen.has(id)) continue; seen.add(id); }
      tr.add(t[0], t[1], t[2]);
      if (own.has(t[0]) || own.has(t[1])) mine.push(t);
    }
  }
  const deposits = tr.deposits(own);
  const px = JSON.parse(readFileSync(arg("prices", "public/price-history.json"), "utf8"));
  const P = new Map(px.map(r => [r.date.slice(0, 10), r.price])), days = [...P.keys()].sort();
  const priceOn = d => { if (P.has(d)) return P.get(d); let b = 0; for (const x of days) { if (x > d) break; b = P.get(x); } return b; };
  const out = ownerCexOut(mine, owners, cex, deposits, priceOn, (k, ts) => sales.has(k + "|" + ts.slice(0, 19)));
  const n = Object.keys(out).length, sum = f => Object.values(out).reduce((a, r) => a + r[f], 0), q = sum("qty");
  // the deposit addresses owners actually used, so the ledger can match a deposit with its withdrawal
  const depositVenue = {};
  for (const [from, to] of mine) if (own.has(from) && deposits.has(to)) depositVenue[to] = deposits.get(to);
  writeFileSync(arg("out", "cex-out.json"), JSON.stringify({ exchanges: cex.size, deposits: deposits.size, owners: out, depositVenue }));
  console.log(`cex-out: ${cex.size} exchange wallets · ${deposits.size} inferred deposit addresses · ${n} owners sent ${Math.round(q).toLocaleString()} SPX, withdrew ${Math.round(sum("back")).toLocaleString()}, net ${Math.round(sum("net")).toLocaleString()}`);
}
