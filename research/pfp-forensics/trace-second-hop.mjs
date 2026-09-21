// ============================================================================
// SECOND HOP — where a cluster's outflows went next.
// ============================================================================
//   node research/pfp-forensics/trace-second-hop.mjs
//
// Follows every wallet a tracked cluster sent SPX to, and classifies what THOSE wallets
// did with it: sold into a pool or router, opened a Uniswap V3 position, deposited to a
// tagged exchange, passed it onward, or still hold.
//
// ⚠ YOU CANNOT TAINT A FUNGIBLE TOKEN. A recipient's later outflows are its own; only a
// share of them can be ours, and no on-chain fact says which. The first pass summed each
// recipient's ENTIRE history and produced 68.9M of "fate" against 4.96M actually sent —
// because one recipient is the Wormhole BRIDGE and another is case #1's trader.
// So: no sums. Per-recipient facts, and COUNTS of how many ever reached each destination.
//
// Also fixed: an LP mint through the NonfungiblePositionManager is not a sale, and tagged
// infrastructure recipients are reported separately from ordinary wallets.
import { readFileSync } from "node:fs";
import { clusterOf, tradeHistory, SPX, POOLS, ROUTERS } from "../../scripts/bot/kol-cluster.mjs";
const NPM = "0xc36442b4a4522e871399cd717abdd847ab11fe88";
const CEX_ERA = "2024-09-29";

const src = readFileSync(new URL("../../scripts/build-onchain-local.mjs", import.meta.url), "utf8");
const TAG = {};
for (const m of src.matchAll(/"(0x[0-9a-f]{40})":\s*\{\s*name:\s*"([^"]+)",\s*kind:\s*"([^"]+)"/g)) TAG[m[1]] = { name: m[2], kind: m[3] };
const BS = "https://eth.blockscout.com/api/v2";
const j = async u => { try { const r = await fetch(u, { headers: { accept: "application/json" } }); return r.ok ? r.json() : null; } catch { return null; } };
async function pages(path, max = 30) { let items = [], p = null;
  for (let i = 0; i < max; i++) { const u = BS + path + (p ? "&" + new URLSearchParams(p) : ""); const d = await j(u); if (!d) break;
    items.push(...(d.items || [])); if (!d.next_page_params) break; p = d.next_page_params; } return items; }
const f = n => Math.round(n).toLocaleString();

const cl = clusterOf(14), mem = new Set(cl.wallets);
const outs = (await tradeHistory(cl.wallets)).filter(r => r.kind === "out" && r.cp && !mem.has(r.cp));
const recips = new Map();
for (const r of outs) { const e = recips.get(r.cp) || { qty: 0, first: r.ts }; e.qty += r.qty; if (r.ts < e.first) e.first = r.ts; recips.set(r.cp, e); }

const plain = [], infra = [];
for (const [a, e] of recips) (TAG[a] ? infra : plain).push([a, e]);
console.log(`HOP 1: ${recips.size} recipients, ${f([...recips.values()].reduce((a,b)=>a+b.qty,0))} SPX`);
console.log(`  ${infra.length} are TAGGED INFRASTRUCTURE (not someone's wallet): ${infra.map(([a])=>TAG[a].name).join(", ") || "none"}`);
console.log(`  ${plain.length} are ordinary wallets — only these are followed.\n`);

let nCex = 0, nSold = 0, nLp = 0, nOnward = 0, nHold = 0, nDead = 0;
const venues = new Set();
for (const [addr, e] of plain.sort((a, b) => b[1].qty - a[1].qty)) {
  const tf = await pages(`/addresses/${addr}/token-transfers?token=${SPX}`);
  const inQ = tf.filter(t => t.to?.hash?.toLowerCase() === addr).reduce((s, t) => s + Number(t.total.value) / 1e8, 0);
  const sent = tf.filter(t => t.from?.hash?.toLowerCase() === addr);
  const bal = tf.reduce((b, t) => b + (t.to?.hash?.toLowerCase() === addr ? 1 : -1) * Number(t.total.value) / 1e8, 0);
  const kinds = new Set(); let last = "";
  for (const t of sent) {
    const to = t.to?.hash?.toLowerCase(), d = t.timestamp.slice(0, 10);
    if (d > last) last = d;
    if (TAG[to]?.kind === "cex") { kinds.add("CEX"); venues.add(TAG[to].name); }
    else if (to === NPM) kinds.add("LP");
    else if (POOLS.has(to) || ROUTERS.has(to) || TAG[to]?.kind === "lp") kinds.add("SOLD");
    else kinds.add("onward");
  }
  if (kinds.has("CEX")) nCex++; if (kinds.has("SOLD")) nSold++; if (kinds.has("LP")) nLp++;
  if (kinds.has("onward")) nOnward++; if (bal > 1) nHold++; if (!sent.length) nDead++;
  const share = inQ ? Math.round(e.qty / inQ * 100) : 0;
  console.log(`${addr}`);
  console.log(`   we sent ${f(e.qty).padStart(9)} (${share}% of everything it ever received) on ${e.first.slice(0,10)}`);
  console.log(`   it went on to: ${[...kinds].join(", ") || "nothing — never sent"}   holds ${f(Math.max(0,bal))}${last ? "   last out " + last : ""}`);
}
console.log(`\n=== OF THE ${plain.length} ORDINARY RECIPIENTS ===`);
console.log(`  ${nSold} sold into a pool or router`);
console.log(`  ${nLp} opened an LP position`);
console.log(`  ${nCex} ever sent SPX to a tagged exchange${venues.size ? "  [" + [...venues].join(", ") + "]" : ""}`);
console.log(`  ${nOnward} passed it to another wallet (a third hop exists)`);
console.log(`  ${nHold} still hold any SPX · ${nDead} never sent anything`);
console.log(`\n  Exchanges held ZERO SPX until ${CEX_ERA}; this cluster moved everything out by ${outs.map(o=>o.ts.slice(0,10)).sort().at(-1)}.`);
console.log(`  No amount here is attributable to this cluster — fungible tokens cannot be tainted. These are counts, not sums.`);
