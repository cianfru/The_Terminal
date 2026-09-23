// AEON OWNER CLUSTERS — who really owns what, and who is accumulating vs distributing.
//
// The by-wallet view understates concentration, because one person can hold across several wallets
// (we found a 3-wallet owner by hand; this generalises it). The linkage signal for an NFT is
// different from a fungible token: there is no balance to drain, so the tell is a FREE TRANSFER —
// a token that moved between two wallets WITHOUT a marketplace sale behind it. People do not gift
// strangers 40 NFTs; they move their own.
//
// Every rule errs toward NOT linking, because the dishonest failure mode is over-merging: fusing two
// strangers OVERSTATES concentration, which is exactly the claim this is meant to measure.
//
//   node scripts/build-aeon-clusters.mjs --transfers=dune/out/aeon_transfers.csv \
//        --sales=dune/out/aeon_sales.csv --code=<addr-code.json> [--out=public/aeon-clusters.json]
import { readFileSync, writeFileSync } from "node:fs";

export const ZERO = "0x" + "0".repeat(40);
const lc = s => String(s || "").toLowerCase();

export function readCsv(text) {
  const [head, ...rows] = text.trim().split("\n");
  const cols = head.split(",");
  return rows.map(r => {
    const v = r.split(","), o = {};
    cols.forEach((c, i) => o[c] = v[i]);
    return o;
  });
}

/** Tag every transfer: mint | burn | sale | free. A sale is one that appears in the sales feed. */
export function classify(transfers, sales) {
  const key = (tid, f, t, d) => `${tid}|${lc(f)}|${lc(t)}|${d}`;
  const sold = new Set(sales.map(s => key(s.token_id, s.seller, s.buyer, (s.time || "").slice(0, 10))));
  return transfers.map(t => {
    const from = lc(t.from_address), to = lc(t.to_address), d = (t.time || "").slice(0, 10);
    const kind = from === ZERO ? "mint" : to === ZERO ? "burn"
      : sold.has(key(t.token_id, from, to, d)) ? "sale" : "free";
    return { from, to, id: t.token_id, date: d, ts: t.time, kind };
  });
}

/** Current owner of every token, from the transfer log alone. */
export function owners(tagged) {
  const o = new Map();
  for (const t of [...tagged].sort((a, b) => a.ts < b.ts ? -1 : 1)) if (t.to !== ZERO) o.set(t.id, t.to);
  return o;
}

/**
 * Link wallets on free transfers, then union-find into owners.
 * Guards, all conservative:
 *   MAX_IN   many distinct senders into one address = a service/custody endpoint, not a person
 *   MAX_OUT  one address feeding many = a distributor/airdropper
 *   MAX_SIZE clusters above this are emitted FLAGGED and must not be trusted as one owner
 */
export function clusterAeon(tagged, { isContract = () => false, minTokens = 3, maxIn = 3, maxOut = 6, maxSize = 12 } = {}) {
  const free = tagged.filter(t => t.kind === "free" && t.from !== ZERO && t.to !== ZERO
    && t.from !== t.to && !isContract(t.from) && !isContract(t.to));

  const pair = new Map();                                    // from|to -> {n, first, last}
  for (const t of free) {
    const k = `${t.from}|${t.to}`;
    let e = pair.get(k); if (!e) pair.set(k, e = { from: t.from, to: t.to, n: 0, first: t.date, last: t.date });
    e.n++; if (t.date < e.first) e.first = t.date; if (t.date > e.last) e.last = t.date;
  }
  const inDeg = new Map(), outDeg = new Map();
  for (const e of [...pair.values()].filter(e => e.n >= minTokens)) {
    (inDeg.get(e.to) || inDeg.set(e.to, new Set()).get(e.to)).add(e.from);
    (outDeg.get(e.from) || outDeg.set(e.from, new Set()).get(e.from)).add(e.to);
  }
  const hub = new Set();
  for (const [a, s] of inDeg) if (s.size > maxIn) hub.add(a);
  for (const [a, s] of outDeg) if (s.size > maxOut) hub.add(a);
  // A single free transfer is usually a GIFT. Moving several tokens to the same address is what
  // people do with their own wallets — 67% of pairs here moved exactly one token, so requiring two
  // is what separates self-custody from generosity. This is the knob that decides over-merging.
  const edges = [...pair.values()].filter(e => e.n >= minTokens && !hub.has(e.from) && !hub.has(e.to));

  const parent = new Map();
  const find = a => { if (!parent.has(a)) parent.set(a, a); while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const e of edges) union(e.from, e.to);

  const groups = new Map();
  for (const a of parent.keys()) { const r = find(a); (groups.get(r) || groups.set(r, []).get(r)).push(a); }
  return { clusters: [...groups.values()].map(w => ({ wallets: w.sort(), flagged: w.length > maxSize })), edges, hub };
}

/** Per-cluster behaviour: what they hold, what they sold, and which way they are moving. */
export function score(clusters, tagged, sales, ownerOf, today) {
  const now = today ? new Date(today) : new Date(Math.max(...tagged.map(t => Date.parse(t.ts))));
  const cut = d => new Date(now.getTime() - d * 864e5).toISOString().slice(0, 10);
  const d30 = cut(30), d90 = cut(90);
  const held = new Map();                                   // wallet -> token count now
  for (const [, o] of ownerOf) held.set(o, (held.get(o) || 0) + 1);

  const byWallet = new Map();                               // wallet -> sale rows
  for (const s of sales) {
    const sell = lc(s.seller), buy = lc(s.buyer);
    (byWallet.get(sell) || byWallet.set(sell, []).get(sell)).push({ ...s, side: "sell" });
    (byWallet.get(buy) || byWallet.set(buy, []).get(buy)).push({ ...s, side: "buy" });
  }
  const moves = new Map();                                  // wallet -> tagged transfers
  for (const t of tagged) {
    if (t.to !== ZERO) (moves.get(t.to) || moves.set(t.to, []).get(t.to)).push(t);
    if (t.from !== ZERO) (moves.get(t.from) || moves.set(t.from, []).get(t.from)).push(t);
  }

  return clusters.map(c => {
    const set = new Set(c.wallets);
    let now_ = 0, soldN = 0, soldEth = 0, boughtN = 0, boughtEth = 0, first = null;
    for (const w of c.wallets) {
      now_ += held.get(w) || 0;
      for (const s of byWallet.get(w) || []) {
        const other = s.side === "sell" ? lc(s.buyer) : lc(s.seller);
        if (set.has(other)) continue;                       // internal shuffle, not a market trade
        const eth = Number(s.price) || 0;
        if (s.side === "sell") { soldN++; soldEth += eth; } else { boughtN++; boughtEth += eth; }
      }
      for (const t of moves.get(w) || []) if (!first || t.date < first) first = t.date;
    }
    const net = days => {
      const from = days === 30 ? d30 : d90;
      let n = 0;
      for (const w of c.wallets) for (const t of moves.get(w) || []) {
        if (t.date < from) continue;
        if (set.has(t.from) && set.has(t.to)) continue;      // internal move
        if (t.to === w) n++; else if (t.from === w) n--;
      }
      return n;
    };
    return { wallets: c.wallets, n: c.wallets.length, flagged: c.flagged, held: now_,
             soldN, soldEth: +soldEth.toFixed(3), boughtN, boughtEth: +boughtEth.toFixed(3),
             d30: net(30), d90: net(90), since: first };
  }).sort((a, b) => b.held - a.held);
}

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split("=").slice(1).join("=") : d; };

if (process.argv[1] && process.argv[1].endsWith("build-aeon-clusters.mjs")) {
  const transfers = readCsv(readFileSync(arg("transfers", "dune/out/aeon_transfers.csv"), "utf8"));
  const sales = readCsv(readFileSync(arg("sales", "dune/out/aeon_sales.csv"), "utf8"));
  let code = {};
  try { code = JSON.parse(readFileSync(arg("code", "public/aeon-addr-code.json"), "utf8")); } catch {
    console.error("! no is-contract cache — every endpoint treated as an EOA, clusters will over-merge");
  }
  const isContract = a => code[a] === true;

  const tagged = classify(transfers, sales);
  const ownerOf = owners(tagged);
  const { clusters, hub } = clusterAeon(tagged, { isContract });

  // Every holder is an owner. A wallet the engine could not link to any other is an owner of one —
  // scoring those too is what makes "who is holding and who is selling" a statement about the whole
  // collection rather than about the 145 clusters we happened to find.
  const linked = new Set(clusters.flatMap(c => c.wallets));
  const solo = [...new Set(ownerOf.values())].filter(a => !linked.has(a) && a !== ZERO)
    .map(a => ({ wallets: [a], flagged: false }));
  const scored = score([...clusters, ...solo], tagged, sales, ownerOf);

  const byWallet = new Map();
  for (const [, o] of ownerOf) byWallet.set(o, (byWallet.get(o) || 0) + 1);
  const trusted = scored.filter(c => !c.flagged);
  const multi = trusted.filter(c => c.n > 1);
  const out = {
    updated: new Date().toISOString().slice(0, 10),
    contract: "0xc374a204334d4Edd4C6a62f0867C752d65E9579c",
    wallets: byWallet.size,
    owners: scored.filter(c => c.held > 0).length,        // entities that hold at least one token TODAY
    entities: scored.length,                              // including ones that have fully exited
    multiWallet: multi.length,
    flagged: scored.filter(c => c.flagged).length,
    hubs: hub.size,
    clusters: scored.filter(c => c.n > 1).slice(0, 200),
    all: scored.map(c => [c.n, c.held, c.boughtN, c.soldN, +c.boughtEth, +c.soldEth]),
  };
  writeFileSync(arg("out", "public/aeon-clusters.json"), JSON.stringify(out));
  const kinds = tagged.reduce((m, t) => (m[t.kind] = (m[t.kind] || 0) + 1, m), {});
  console.log(`transfers ${tagged.length}  ${JSON.stringify(kinds)}`);
  console.log(`wallets ${out.wallets} -> owners ${out.owners}   multi-wallet clusters ${out.multiWallet} (flagged ${out.flagged}, hubs dropped ${out.hubs})`);
  console.log(`\ntop clusters by tokens held:`);
  for (const c of multi.slice(0, 12))
    console.log(`  ${String(c.held).padStart(4)} tokens  ${c.n} wallets  sold ${String(c.soldN).padStart(3)} (${c.soldEth}E)  bought ${String(c.boughtN).padStart(3)}  30d ${c.d30 >= 0 ? "+" : ""}${c.d30}  since ${c.since}`);
}
