// ============================================================================
// LANDSCAPE LEDGER — every SPX transfer on Ethereum, indexed by address, in memory.
// ============================================================================
// Phase 1 of the AEON landscape study: is each AEON household holding its SPX, or selling?
//
// The four hand-built cases pulled every ledger from Blockscout, ~200 requests a household.
// At collection scale that is hours of rate-limited reads. The full Ethereum SPX history
// already exists — the release-asset archive (2.7M transfers) plus a Blockscout tail from
// where it stops — so ledgers, venue classification and structural clustering all run here,
// locally, for free. Blockscout is kept for what the archive cannot show: the other legs of
// a transaction (RFQ sales, rotations), which need a hash the archive never carried.
//
// Columnar and interned, because 2.7M rows as JS objects is ~1 GB and this is ~60 MB:
//   from, to  Uint32Array   address ids
//   t         Float64Array  ms since epoch
//   v         Float64Array  SPX (raw / 1e8)
// plus a CSR index so an address's rows are one slice away.
// ============================================================================
import { createReadStream, readFileSync, existsSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { POOLS, ROUTERS } from "../../../scripts/bot/kol-cluster.mjs";

export const ZERO = "0x0000000000000000000000000000000000000000";
export const DEAD = "0x000000000000000000000000000000000000dead";

/** "2023-08-16 02:42:47 UTC" and "2026-08-26 05:46:47.000 UTC" both occur in the archive. */
export const parseTime = s => Date.parse(s.replace(" UTC", "").replace(" ", "T") + "Z");

/** Venue verdict for one transfer, from the counterparty alone. The archive has no hash, so
 *  this is the fast path only; LP deposits read as sells here and RFQ sales as transfers,
 *  and phase 3's shape pass exists to correct exactly those. */
export function venueKind(dir, cp) {
  if (!cp) return dir === "IN" ? "in" : "out";
  if (cp === ZERO) return dir === "IN" ? "mint" : "burn";
  if (POOLS.has(cp) || ROUTERS.has(cp)) return dir === "IN" ? "buy" : "sell";
  return dir === "IN" ? "in" : "out";
}

export async function loadLedger(files) {
  const id = new Map(), addrs = [];
  const intern = a => { let k = id.get(a); if (k === undefined) { k = addrs.length; id.set(a, k); addrs.push(a); } return k; };
  let cap = 3_000_000, n = 0;
  let from = new Uint32Array(cap), to = new Uint32Array(cap), t = new Float64Array(cap), v = new Float64Array(cap);
  const grow = () => {
    cap *= 1.5; cap |= 0;
    const g = (A, C) => { const b = new C(cap); b.set(A); return b; };
    from = g(from, Uint32Array); to = g(to, Uint32Array); t = g(t, Float64Array); v = g(v, Float64Array);
  };
  let latest = 0;
  for (const f of files) {
    if (!existsSync(f)) throw new Error(`missing ledger source ${f}`);
    const src = f.endsWith(".gz") ? createReadStream(f).pipe(createGunzip()) : createReadStream(f);
    let head = true;
    for await (const line of createInterface({ input: src, crlfDelay: Infinity })) {
      if (head) { head = false; continue; }
      if (!line) continue;
      const c = line.split(",");
      if (n >= cap) grow();
      from[n] = intern(c[0].toLowerCase()); to[n] = intern(c[1].toLowerCase());
      t[n] = parseTime(c[2]); v[n] = Number(c[3]) / 1e8;
      if (t[n] > latest) latest = t[n];
      n++;
    }
  }
  // CSR: every row indexed under both its sender and its receiver
  const deg = new Uint32Array(addrs.length + 1);
  for (let i = 0; i < n; i++) { deg[from[i] + 1]++; if (to[i] !== from[i]) deg[to[i] + 1]++; }
  for (let i = 1; i < deg.length; i++) deg[i] += deg[i - 1];
  const idx = new Uint32Array(deg[addrs.length]), fill = deg.slice(0, addrs.length);
  for (let i = 0; i < n; i++) { idx[fill[from[i]]++] = i; if (to[i] !== from[i]) idx[fill[to[i]]++] = i; }

  const L = {
    n, addrs, latest, has: a => id.has(a.toLowerCase()),
    /** One address's SPX history, oldest first, each row from that address's point of view. */
    ledger(a) {
      const k = id.get(a.toLowerCase()); if (k === undefined) return [];
      const out = [];
      for (let p = deg[k]; p < deg[k + 1]; p++) {
        const i = idx[p], dir = to[i] === k ? "IN" : "OUT";
        out.push({ t: t[i], dir, cp: addrs[dir === "IN" ? from[i] : to[i]], qty: v[i] });
      }
      return out.sort((x, y) => x.t - y.t);
    },
    balance(a) { let b = 0; for (const r of L.ledger(a)) b += r.dir === "IN" ? r.qty : -r.qty; return b; },
  };
  return L;
}

/** A household's trades, with transfers between its own wallets removed — a wallet hop is
 *  not a decision, and counting it would double every migration as a sale plus a buy. */
export function householdRows(L, wallets) {
  const set = new Set(wallets.map(a => a.toLowerCase()));
  const rows = [];
  for (const w of set) for (const r of L.ledger(w)) {
    if (set.has(r.cp)) continue;
    rows.push({ ...r, wallet: w, kind: venueKind(r.dir, r.cp) });
  }
  return rows.sort((a, b) => a.t - b.t);
}
