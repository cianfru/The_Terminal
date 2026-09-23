// AEON OWNERSHIP — who holds each of the 3,333 tokens right now, from an independent source.
//   node research/pfp-forensics/landscape/aeon-owners.mjs --out=aeon-owners.json [--check=public/aeon-onchain.json]
//
// The source is the AEON CONTRACT ITSELF: ownerOf(id) for all 3,333 tokens, batched over a free public
// Ethereum node (no key, ~34 requests). The site's own holder counts come from replaying every transfer
// (Alchemy → build-aeon-onchain.mjs); --check compares the two wallet by wallet. The output (token →
// owner) is what the ledger uses to give each owner its exact pieces.
//
// ⚠ NOT Blockscout's instance listing: its `owner` field was stale for 3 tokens on 2026-09-23 (it named
// wallets that had sold the piece in Nov-2023; ownerOf and our replay both agreed on the real owner).
import { readFileSync, writeFileSync } from "node:fs";

const AEON = "0xc374a204334d4edd4c6a62f0867c752d65e9579c";
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const RPCS = ["https://eth.drpc.org", "https://ethereum-rpc.publicnode.com", "https://rpc.flashbots.net"];
const pad = n => BigInt(n).toString(16).padStart(64, "0");
async function ownersOf(ids) {
  const body = JSON.stringify(ids.map((id, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call",
    params: [{ to: AEON, data: "0x6352211e" + pad(id) }, "latest"] })));
  for (let i = 0; i < 9; i++) {
    try {
      const r = await fetch(RPCS[i % RPCS.length], { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(30000) });
      const j = await r.json();
      if (Array.isArray(j) && j.length === ids.length && j.every(x => typeof x.result === "string" && x.result.length >= 42))
        return j.sort((a, b) => a.id - b.id).map(x => "0x" + x.result.slice(-40).toLowerCase());
    } catch { /* next node */ }
    await sleep(500 * (i + 1));
  }
  throw new Error(`ownerOf failed for tokens ${ids[0]}…${ids.at(-1)} — refusing to write a partial ownership map`);
}

/** Compare two owner → count maps. Pure. */
export function compareOwners(a, b) {
  const all = new Set([...a.keys(), ...b.keys()]);
  const diff = [];
  for (const k of all) if ((a.get(k) || 0) !== (b.get(k) || 0)) diff.push({ owner: k, a: a.get(k) || 0, b: b.get(k) || 0 });
  return diff;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const owners = {};
  const ids = Array.from({ length: 3333 }, (_, i) => i + 1);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100), got = await ownersOf(chunk);
    chunk.forEach((id, k) => { owners[id] = got[k]; });
  }
  const n = Object.keys(owners).length;
  if (n < 3300) throw new Error(`only ${n} tokens listed — refusing to write a partial ownership map`);
  writeFileSync(arg("out", "aeon-owners.json"), JSON.stringify({ asOf: new Date().toISOString(), tokens: n, owners }));
  const count = new Map();
  for (const o of Object.values(owners)) if (o && o !== "0x000000000000000000000000000000000000dead") count.set(o, (count.get(o) || 0) + 1);
  console.log(`aeon-owners: ${n} tokens · ${count.size} owners (ownerOf on the contract)`);
  if (arg("check")) {
    const mine = new Map(JSON.parse(readFileSync(arg("check"), "utf8")).holders.map(h => [h.a.toLowerCase(), h.n]));
    const diff = compareOwners(count, mine);
    console.log(`check vs ${arg("check")}: ${mine.size} owners there · ${diff.length} wallet(s) disagree`);
    for (const d of diff.slice(0, 15)) console.log(`  ${d.owner}  contract ${d.a} · ours ${d.b}`);
  }
}
