// ============================================================================
// LANDSCAPE HOUSEHOLDS — phase 2: group every AEON holder's wallets into households.
// ============================================================================
// The same structural rules as scripts/cluster-pfp.mjs, run over the in-memory ledger
// instead of ~200 Blockscout reads per seed, so the whole collection clusters in minutes:
//
//   DRAIN          A emptied >= 90% of its balance into B, and B held nothing before.
//   VAULT          B held nothing, received from A, has never sent SPX, still holds most of it.
//   CONSOLIDATION  2+ wallets each drained into one B, empty before the first, within 24h.
//
// Size-free, like every rule in this work — small is often the finding. Never through a
// pool, router, tagged address or contract. GAS links are NOT used: they were always the
// circumstantial tier and never entered a headline, so a population study built on them
// would inherit a rule the case studies deliberately kept out of their numbers.
//
// ⚠ A HOUSEHOLD IS THE STRUCTURAL COMPONENT ONLY. cluster-pfp puts into "core" the ends of
// any structural link it met while exploring — including links hanging off a wallet it
// reached only through GAS. That is how #2451's core came to hold two dust wallets
// (0 and 2 SPX) with no structural path to the seed. Here membership is strictly the
// connected component under structural links, so a gas-only neighbour cannot import its
// own vaults.
//
// Transfers carry no hash in the archive, so the two sides of one transfer are matched on
// (time, amount, counterparty). Within one block, receives are applied before sends — the
// same heuristic the FIFO engine uses — or a wallet that receives and forwards in a single
// block reads as overdrawn and every drain through it is missed.
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { POOLS, ROUTERS } from "../../../scripts/bot/kol-cluster.mjs";
import { loadTags, codeIsContract, DRAIN_FRAC, VAULT_KEEP, MAX_DRAINED,
         CONSOLIDATION_WINDOW_H, CONSOLIDATION_MIN } from "../../../scripts/cluster-pfp.mjs";
import { ZERO, DEAD } from "./ledger.mjs";

export const MAX_DEPTH = 3;
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://rpc.flashbots.net"];

/** Balance before and after each row, receives first within a block. Pure. */
export function withBal(rows) {
  const s = rows.slice().sort((a, b) => a.t - b.t || (a.dir === b.dir ? 0 : a.dir === "IN" ? -1 : 1));
  let b = 0;
  return s.map(r => { const before = b; b += r.dir === "IN" ? r.qty : -r.qty; return { ...r, before, after: b }; });
}

export async function makeInfra(cacheFile, seedTypes = {}) {
  const tags = loadTags();
  // ⚠ ONLY THE CACHE'S "eoa" LABELS ARE TRUSTED. The production cache (enrich-addr-types.mjs)
  // calls any address with code a contract, and since Pectra a wallet that delegated via
  // EIP-7702 carries code 0xef0100… — an ordinary wallet, filed as infrastructure. It severed
  // the 72-second consolidation on case #14 and hid 384,955 SPX; in a sample of 60 cached
  // "contracts", 20 were delegated wallets. Every "contract" is re-read with codeIsContract.
  const seeded = Object.fromEntries(Object.entries(seedTypes).filter(([, v]) => v === "eoa"));
  const types = { ...seeded, ...(existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {}) };
  let fetched = 0;
  const code = async a => {
    for (let i = 0; i < 9; i++) {
      try {
        const r = await (await fetch(RPCS[i % RPCS.length], { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [a, "latest"] }) })).json();
        if (r?.result != null) return r.result;
      } catch {}
      await new Promise(x => setTimeout(x, 250 * (i + 1)));
    }
    throw new Error(`eth_getCode failed for ${a} — refusing to guess whether it is a contract`);
  };
  const isInfra = async a => {
    if (!a || a === ZERO || a === DEAD || tags[a] || POOLS.has(a) || ROUTERS.has(a)) return true;
    if (!(a in types)) { types[a] = codeIsContract(await code(a)) ? "contract" : "eoa"; fetched++; }
    return types[a] === "contract";
  };
  return { isInfra, save: () => writeFileSync(cacheFile, JSON.stringify(types)), fetched: () => fetched };
}

/** Every structural link touching wallet `a`, found from both ends. */
export async function linksOf(L, a, isInfra, memo = new Map()) {
  const led = w => { if (!memo.has(w)) memo.set(w, withBal(L.ledger(w))); return memo.get(w); };
  const rowsA = led(a), out = [];
  // a sender is a DISTRIBUTOR, not a migrator, if it has drained itself into more than
  // MAX_DRAINED different wallets; its drains stop being evidence of shared ownership
  const fanOut = w => {
    const t = new Set();
    for (const r of led(w)) if (r.dir === "OUT" && r.before > 0 && r.qty >= r.before * DRAIN_FRAC) t.add(r.cp);
    return t.size;
  };
  const drained = (w, r) => r.before > 0 && r.qty >= r.before * DRAIN_FRAC;
  const match = (w, dir, cp, t, qty) => led(w).find(x => x.dir === dir && x.cp === cp && x.t === t && Math.abs(x.qty - qty) < 1e-6);
  const neverSends = w => !led(w).some(x => x.dir === "OUT");

  for (const r of rowsA) {
    if (await isInfra(r.cp)) continue;
    const from = r.dir === "OUT" ? a : r.cp, to = r.dir === "OUT" ? r.cp : a;
    const sOut = r.dir === "OUT" ? r : match(from, "OUT", to, r.t, r.qty);
    const rIn  = r.dir === "IN"  ? r : match(to, "IN", from, r.t, r.qty);
    if (!sOut || !rIn) continue;

    if (drained(from, sOut) && rIn.before < 1 && fanOut(from) <= MAX_DRAINED) {
      out.push({ rule: "DRAIN", from, to, qty: r.qty, t: r.t }); continue;
    }
    if (rIn.before < 1 && neverSends(to) && led(to).at(-1).after >= rIn.qty * VAULT_KEEP) {
      out.push({ rule: "VAULT", from, to, qty: r.qty, t: r.t }); continue;
    }
    // N-to-1: `to` was empty before the first drain of a group of >= 2 draining senders
    const ins = led(to).filter(x => x.dir === "IN");
    const start = [...ins].reverse().find(x => x.before < 1 && x.t <= rIn.t);
    if (!start) continue;
    const limit = start.t + CONSOLIDATION_WINDOW_H * 3600e3;
    const group = [];
    for (const x of ins) {
      if (x.t < start.t || x.t > limit || await isInfra(x.cp)) continue;
      const so = match(x.cp, "OUT", to, x.t, x.qty);
      if (so && drained(x.cp, so)) group.push(x);
    }
    const senders = [...new Set(group.map(x => x.cp))];
    if (senders.length >= CONSOLIDATION_MIN && senders.includes(from))
      out.push({ rule: "CONSOLIDATION", from, to, qty: r.qty, t: r.t });
  }
  return out;
}

/** Structural component of each seed, merged across seeds with union-find. */
export async function households(L, seeds, isInfra, { maxDepth = MAX_DEPTH, onSeed } = {}) {
  const parent = new Map();
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const add = x => { if (!parent.has(x)) parent.set(x, x); };
  const union = (a, b) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const allLinks = [], seen = new Set(), memo = new Map();
  let i = 0;
  for (const s0 of seeds) {
    const s = s0.toLowerCase(); add(s);
    const depth = new Map([[s, 0]]), q = [s];
    while (q.length) {
      const a = q.shift();
      if (seen.has(a)) continue;
      seen.add(a);
      if (depth.get(a) >= maxDepth) continue;
      for (const l of await linksOf(L, a, isInfra, memo)) {
        union(l.from, l.to);
        allLinks.push(l);
        const nb = l.from === a ? l.to : l.from;
        if (!depth.has(nb)) { depth.set(nb, depth.get(a) + 1); q.push(nb); }
      }
    }
    if (memo.size > 60000) memo.clear();     // bound memory on the long sweep
    onSeed?.(++i, seeds.length);
  }
  const groups = new Map();
  for (const x of parent.keys()) { const r = find(x); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(x); }
  const key = l => `${l.t}|${l.from}|${l.to}`;
  const uniq = [...new Map(allLinks.map(l => [key(l), l])).values()];
  return { groups: [...groups.values()], links: uniq };
}
