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

/** Distinct wallets A has ever sent SPX to. Many = a distributor, so its drains prove nothing. */
export async function drainFanOut(a, rows) {
  return new Set((rows ?? await ledger(a)).filter(r => r.dir === "OUT" && r.cp).map(r => r.cp)).size;
}

/** Everyone A ever paid gas to. Few recipients = evidence; many = a service. */
async function gasOut(a) {
  const txs = await pages(`/addresses/${a}/transactions`, 4);
  const sends = txs.filter(t => t.from?.hash?.toLowerCase() === a && Number(t.value || 0) > 0);
  const dests = new Set(sends.map(t => t.to?.hash?.toLowerCase()).filter(Boolean));
  return { dests, service: dests.size > MAX_FUNDED, sends };
}

export async function clusterPfp(seed, { maxDepth = MAX_DEPTH, tags = loadTags() } = {}) {
  seed = seed.toLowerCase();
  const depth = { [seed]: 0 }, seen = new Set(), queue = [seed], links = [];
  const skip = async a => !!tags[a] || await contract(a);

  while (queue.length) {
    const a = queue.shift();
    if (seen.has(a)) continue;
    seen.add(a);
    if (await skip(a) || depth[a] >= maxDepth) continue;

    const { dests, service, sends } = await gasOut(a);
    if (service) process.stderr.write(`  ${a}: funds ${dests.size} wallets — service, gas links dropped\n`);
    else for (const t of sends) {
      const b = t.to?.hash?.toLowerCase();
      if (!b || await skip(b)) continue;
      links.push({ rule: "GAS", from: a, to: b, eth: Number(t.value) / 1e18, ts: t.timestamp.slice(0, 19), tx: t.hash });
      if (!(b in depth)) { depth[b] = depth[a] + 1; queue.push(b); }
    }

    const rows = await ledger(a);
    const myFanOut = await drainFanOut(a, rows);
    if (myFanOut > MAX_DRAINED) process.stderr.write(`  ${a}: sends SPX to ${myFanOut} wallets — distributor, outbound drains dropped\n`);

    for (const r of rows) {
      if (!r.cp || await skip(r.cp)) continue;
      const other = r.dir === "OUT" ? r.cp : a, from = r.dir === "OUT" ? a : r.cp;
      // guard the SENDER of this particular link, whichever side it is
      if (await drainFanOut(from) > MAX_DRAINED) continue;
      const sOut = (await ledger(from)).find(x => x.tx === r.tx && x.dir === "OUT");
      const rIn  = (await ledger(r.dir === "OUT" ? r.cp : a)).find(x => x.tx === r.tx && x.dir === "IN");
      if (!isDrainIntoEmpty(sOut, rIn)) continue;
      links.push({ rule: "DRAIN", from, to: r.dir === "OUT" ? r.cp : a, qty: r.qty, ts: r.ts.slice(0, 19), tx: r.tx });
      const nb = from === a ? other : from;
      if (!(nb in depth)) { depth[nb] = depth[a] + 1; queue.push(nb); }
    }
  }

  const uniq = [...new Map(links.map(l => [l.rule + l.tx + l.to, l])).values()].sort((x, y) => x.ts.localeCompare(y.ts));
  const members = [...new Set(uniq.flatMap(l => [l.from, l.to]))];
  return { seed, members, links: uniq, depth };
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
  console.log(`\nCLUSTER of ${seed}\n  ${res.members.length} wallets, ${res.links.length} links\n`);
  for (const l of res.links)
    console.log(`  ${l.ts}  ${l.rule.padEnd(5)} ${l.rule === "GAS" ? `${l.eth.toFixed(5)} ETH` : `${f(l.qty)} SPX`}   ${l.from} -> ${l.to}`);
  console.log(`\n  SPX held today:`);
  let tot = 0;
  for (const a of res.members) { tot += bal[a]; console.log(`    ${a}  ${f(bal[a]).padStart(12)}`); }
  console.log(`    ${"TOTAL".padEnd(42)} ${f(tot).padStart(12)} SPX`);
  const out = arg("json");
  if (out) { writeFileSync(out, JSON.stringify({ ...res, balances: bal, total: tot }, null, 1)); console.log(`\n-> ${out}`); }
}
