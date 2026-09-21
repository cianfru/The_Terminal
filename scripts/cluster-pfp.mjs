#!/usr/bin/env node
// ============================================================================
// CLUSTER-PFP — wallet clustering for PFP forensics.
// ============================================================================
//   node scripts/cluster-pfp.mjs --addr=0x... [--token=14] [--json=out.json]
//
// This is NOT clusterEntities and must not be swapped for it. That engine exists to keep
// CONCENTRATION honest, so it errs toward not-merging and gates FUND at 50,000 SPX. Both
// choices are wrong here:
//
//   * the 50,000 floor is a TOKEN count. SPX has moved ~1,000x since launch, so in 2023 it
//     was a $108 tip — and the community passed round 69,420 / 111,111 / 123,456 constantly.
//     Run from a 2023 wallet it over-merges into the dozens (63 wallets on case #14).
//   * and it UNDER-merges for the wallets this work is about. An influencer can be loud and
//     hold nothing: #2559 holds 8,558 SPX, #3062's trader keeps 138. A 50,000 floor cannot
//     see them. Here small IS the finding, so self-moves have NO minimum.
//
// Structure over size. A link needs one of:
//   GAS    - A paid B's gas, and A funds few enough wallets to not be a service.
//   DRAIN  - A emptied >=90% of its balance into B, and B held nothing before. Any size.
//   NFT    - the token's own custody chain (handled by the caller; recorded for completeness).
// Never through a tagged CEX / LP / contract. Never a partial send between two live wallets.
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";

const SPX = "0xE0f63A424a4439cBE457d80e4f4b51ad25b2c56C";
const BS = "https://eth.blockscout.com/api/v2";
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://rpc.flashbots.net"];

// A gas funder is only evidence if it funds a HANDFUL of wallets. One funder on case #14 fed
// 42 distinct addresses — a service, worth nothing. The production engine's hub guard is 8.
export const MAX_FUNDED = 8;

// The same guard has to apply to DRAINS, or the tool over-merges on a payout wallet. A drain
// EMPTIES the sender, so a person migrating can only do it once per refill; a wallet that
// repeatedly empties itself into different fresh wallets is distributing, not migrating.
// Tighter than MAX_FUNDED because drain-into-empty is otherwise the stronger claim of the two.
export const MAX_DRAINED = 4;

// A VAULT: a wallet that was empty, received a chunk, still holds most of it, and has NEVER
// sent SPX anywhere. This is NOT the "partial send between two live wallets" the production
// engine rightly refuses — that refusal exists because a payment recipient is a counterparty.
// A vault is not a counterparty: it never spends. It is storage.
//
// This rule is why the tool missed case #2451's 401,900-SPX vault on the first pass: the
// trader funded it with a partial send (no drain) and it has never transacted (no gas link),
// so it was invisible to both rules. Vaults are the single most common structure in this
// work — #2451 has one, #3062 has seven — so missing them missed the point.
export const VAULT_KEEP = 0.90;
export const DRAIN_FRAC = 0.90;
export const MAX_DEPTH = 3;

const j = async u => { try { const r = await fetch(u, { headers: { accept: "application/json" } }); return r.ok ? r.json() : null; } catch { return null; } };
const rpc = async (m, p) => {
  for (let i = 0; i < 9; i++) {
    try {
      const r = await (await fetch(RPCS[i % RPCS.length], { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) })).json();
      if (r?.result != null) return r.result;
    } catch {}
    await new Promise(x => setTimeout(x, 250 * (i + 1)));
  }
  return null;
};

async function pages(path, max = 40) {
  let items = [], p = null;
  for (let i = 0; i < max; i++) {
    const u = BS + path + (p ? (path.includes("?") ? "&" : "?") + new URLSearchParams(p) : "");
    const d = await j(u); if (!d) break;
    items.push(...(d.items || []));
    if (!d.next_page_params) break;
    p = d.next_page_params;
  }
  return items;
}

/** Tagged infrastructure, read from the FIFO engine so the two can never drift. */
export function loadTags(src = readFileSync(new URL("./build-onchain-local.mjs", import.meta.url), "utf8")) {
  const tags = {};
  for (const m of src.matchAll(/"(0x[0-9a-f]{40})":\s*\{\s*name:\s*"([^"]+)",\s*kind:\s*"([^"]+)"/g))
    tags[m[1]] = { name: m[2], kind: m[3] };
  return tags;
}

/** Code beginning 0xef0100 is an EIP-7702 delegation designator: an EOA that opted into a smart
 *  account. Pectra shipped May 2025, so code TODAY says nothing about 2023-24 history. Treating
 *  it as a contract retroactively erases every link through that wallet. */
export const isDelegatedEoa = code => typeof code === "string" && code.toLowerCase().startsWith("0xef0100");
export const codeIsContract = code => !!(code && code !== "0x" && !isDelegatedEoa(code));

/** Running balance before each transfer — the only way to tell a drain from an ordinary payment. */
export function withBalances(rows) {
  let bal = 0;
  return rows.slice().sort((a, b) => a.ts.localeCompare(b.ts)).map(r => {
    const balBefore = bal; bal += r.dir === "IN" ? r.qty : -r.qty;
    return { ...r, balBefore, balAfter: bal };
  });
}

/** A vault link: B held nothing, received `qty` from A, never sent SPX, and still holds
 *  at least VAULT_KEEP of what it got. Size-free, like every rule here. */
export function isVault(recvIn, recvRows, keep = VAULT_KEEP) {
  if (!recvIn || recvIn.balBefore >= 1) return false;
  if (recvRows.some(r => r.dir === "OUT")) return false;   // it spends => not a vault
  const held = recvRows.reduce((b, r) => b + (r.dir === "IN" ? r.qty : -r.qty), 0);
  return held >= recvIn.qty * keep;
}

/** A drain-into-empty: A emptied itself into B, and B was empty. Both, at any size. */
export function isDrainIntoEmpty(senderOut, recvIn, frac = DRAIN_FRAC) {
  if (!senderOut || !recvIn) return false;
  return senderOut.balBefore > 0 && senderOut.qty >= senderOut.balBefore * frac && recvIn.balBefore < 1;
}

const code = {};
async function contract(a) { if (!(a in code)) code[a] = codeIsContract(await rpc("eth_getCode", [a, "latest"])); return code[a]; }

const led = {};
async function ledger(a) {
  if (led[a]) return led[a];
  const tf = await pages(`/addresses/${a}/token-transfers?token=${SPX}`);
  led[a] = withBalances(tf.map(t => ({
    ts: t.timestamp, dir: t.to?.hash?.toLowerCase() === a ? "IN" : "OUT",
    qty: Number(t.total?.value) / 1e8,
    cp: (t.to?.hash?.toLowerCase() === a ? t.from : t.to)?.hash?.toLowerCase(),
    tx: t.transaction_hash,
  })));
  return led[a];
}

/** Distinct PLAIN WALLETS A has ever sent SPX to. Many = a distributor, so its drains prove
 *  nothing. Infrastructure must not count: an active trader selling into Uniswap racks up
 *  "recipients" that are pools, and reads as a distributor when it is just someone trading.
 *  That mistake silenced case #2451 entirely — 15 counted recipients, mostly pools. */
export async function drainFanOut(a, rows, skip = async () => false) {
  const cps = new Set((rows ?? await ledger(a)).filter(r => r.dir === "OUT" && r.cp).map(r => r.cp));
  let n = 0;
  for (const cp of cps) if (!await skip(cp)) n++;
  return n;
}

/** Every PLAIN WALLET A ever paid gas to. Few = evidence; many = a service. ETH sent to a
 *  contract is a transaction fee or a swap, never "funding someone's wallet", so it is not
 *  counted and its link is not offered. */
async function gasOut(a, skip = async () => false) {
  const txs = await pages(`/addresses/${a}/transactions`, 4);
  const sends = [];
  for (const t of txs) {
    if (t.from?.hash?.toLowerCase() !== a || !(Number(t.value || 0) > 0)) continue;
    const to = t.to?.hash?.toLowerCase();
    if (!to || await skip(to)) continue;
    sends.push(t);
  }
  const dests = new Set(sends.map(t => t.to.hash.toLowerCase()));
  return { dests, service: dests.size > MAX_FUNDED, sends };
}

export async function clusterPfp(seed, { maxDepth = MAX_DEPTH, tags = loadTags() } = {}) {
  seed = seed.toLowerCase();
  const depth = { [seed]: 0 }, seen = new Set(), queue = [seed], links = [], services = new Set();
  const skip = async a => !!tags[a] || await contract(a);

  while (queue.length) {
    const a = queue.shift();
    if (seen.has(a)) continue;
    seen.add(a);
    if (await skip(a) || depth[a] >= maxDepth) continue;

    const { dests, service, sends } = await gasOut(a, skip);
    if (service) { services.add(a); process.stderr.write(`  ${a}: funds ${dests.size} wallets — service, gas links dropped\n`); }
    else for (const t of sends) {
      const b = t.to?.hash?.toLowerCase();
      if (!b || await skip(b)) continue;
      links.push({ rule: "GAS", from: a, to: b, eth: Number(t.value) / 1e18, ts: t.timestamp.slice(0, 19), tx: t.hash });
      if (!(b in depth)) { depth[b] = depth[a] + 1; queue.push(b); }
    }

    const rows = await ledger(a);
    const myFanOut = await drainFanOut(a, rows, skip);
    if (myFanOut > MAX_DRAINED) process.stderr.write(`  ${a}: sends SPX to ${myFanOut} wallets — distributor, outbound drains dropped\n`);

    for (const r of rows) {
      if (!r.cp || await skip(r.cp)) continue;
      const other = r.dir === "OUT" ? r.cp : a, from = r.dir === "OUT" ? a : r.cp;

      const sOut = (await ledger(from)).find(x => x.tx === r.tx && x.dir === "OUT");
      const rIn  = (await ledger(r.dir === "OUT" ? r.cp : a)).find(x => x.tx === r.tx && x.dir === "IN");
      const to = r.dir === "OUT" ? r.cp : a;
      // The distributor guard applies to DRAIN only. A vault operator funds many vaults BY
      // DEFINITION — case #3062 has seven — so fan-out cannot disqualify a vault. A vault
      // link is self-validating anyway: the recipient has never spent, so it is not a
      // customer being paid. Blocking it on fan-out is what left #3062 at one wallet.
      const drains = isDrainIntoEmpty(sOut, rIn) && await drainFanOut(from, null, skip) <= MAX_DRAINED;
      const rule = drains ? "DRAIN" : isVault(rIn, await ledger(to)) ? "VAULT" : null;
      if (!rule) continue;
      links.push({ rule, from, to, qty: r.qty, ts: r.ts.slice(0, 19), tx: r.tx });
      const nb = from === a ? other : from;
      if (!(nb in depth)) { depth[nb] = depth[a] + 1; queue.push(nb); }
    }
  }

  const uniq = [...new Map(links.map(l => [l.rule + l.tx + l.to, l])).values()].sort((x, y) => x.ts.localeCompare(y.ts));
  // The SEED is always a member, links or not. A case with no qualifying links is a real
  // answer ("this wallet stands alone"); reporting an EMPTY cluster instead prints
  // "holds 0 SPX" for a wallet that holds plenty, which is worse than the bar it replaced.
  // A service can be a gas DESTINATION, which made it a member on the first pass — one of
  // them funds 42 unrelated wallets. It is never part of anyone's household.
  const kept = uniq.filter(l => !services.has(l.from) && !services.has(l.to));

  // TWO TIERS, NEVER SUMMED. A VAULT/DRAIN link is structural: it is SPX flow into a wallet
  // that provably never spent, or a wallet emptying itself. A GAS link is circumstantial —
  // someone paid someone's fee. On case #2451 the vault tier reproduced the hand-built
  // cluster exactly (410,623 vs 410,591, the difference three dust vaults) while the gas
  // tier dragged in a 42-wallet service and bridged into an unrelated case. Both are worth
  // reporting — gas was the ONLY evidence on case #14 — but the headline is the core.
  const core = [...new Set([seed, ...kept.filter(l => l.rule !== "GAS").flatMap(l => [l.from, l.to])])];
  const coreSet = new Set(core);
  const gasLinked = [...new Set(kept.filter(l => l.rule === "GAS").flatMap(l => [l.from, l.to]))]
    .filter(a => !coreSet.has(a));
  return { seed, core, gasLinked, members: [...core, ...gasLinked], links: kept, depth, services: [...services] };
}

/** Current SPX balance — small is a finding here, never a reason to drop a wallet. */
export async function balances(addrs) {
  const out = {};
  for (const a of addrs) {
    const b = await j(`${BS}/addresses/${a}/token-balances`);
    const s = (b || []).find(x => (x.token?.address_hash || x.token?.address || "").toLowerCase() === SPX.toLowerCase());
    out[a] = s ? Number(s.value) / 1e8 : 0;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=")[1];
  const seed = arg("addr");
  if (!seed) { console.error("usage: node scripts/cluster-pfp.mjs --addr=0x... [--json=out.json]"); process.exit(1); }
  const res = await clusterPfp(seed);
  const bal = await balances(res.members);
  const f = n => Math.round(n).toLocaleString();
  const sum = list => list.reduce((s, a) => s + (bal[a] || 0), 0);
  console.log(`\nCLUSTER of ${seed}`);
  console.log(`\n  CORE — vault / drain links (structural). ${res.core.length} wallets, ${f(sum(res.core))} SPX`);
  for (const l of res.links.filter(l => l.rule !== "GAS"))
    console.log(`    ${l.ts.slice(0, 10)}  ${l.rule.padEnd(5)} ${f(l.qty).padStart(9)} SPX   ${l.from} -> ${l.to}`);
  for (const a of res.core) console.log(`    ${a}  ${f(bal[a]).padStart(12)}`);
  console.log(`\n  SUPPORTING — gas-funding only (circumstantial, do NOT add to the headline).`);
  console.log(`  ${res.gasLinked.length} wallets, ${f(sum(res.gasLinked))} SPX`);
  for (const a of res.gasLinked) console.log(`    ${a}  ${f(bal[a]).padStart(12)}`);
  const tot = sum(res.members);
  const out = arg("json");
  if (out) { writeFileSync(out, JSON.stringify({ ...res, balances: bal, total: tot }, null, 1)); console.log(`\n-> ${out}`); }
}
