#!/usr/bin/env node
// ============================================================================
// FIND-SCENE — discover new PFP-forensics cases from NFT co-membership.
// ============================================================================
//   node research/pfp-forensics/find-scene.mjs [--case=2451] [--min=3] [--write]
//
// A traced case tells us one household's SPX behaviour. It also tells us which NFT
// collections that household COLLECTS, and that turns out to be a far better lead
// generator than anything social: collection membership is on-chain, permanent, and
// cannot be edited after the fact — unlike a profile picture, whose history X
// deliberately keeps out of the Internet Archive (one capture exists for the handle we
// probed; every other date returns nothing).
//
// So the search runs CHAIN -> SOCIAL, never the reverse. Start from custody, end at a
// picture. The picture is the lead, never the evidence.
//
// METHOD
//   1. take a traced case's wallets, list every NFT collection they hold (ETH + Base)
//   2. drop the spam (see below), keep the genuine collections = "the scene"
//   3. pull every holder of every scene collection
//   4. keep the ones that also hold SPX and are not already a traced case
//   5. rank by SCENE DEPTH — how many scene collections a wallet appears in
//
// ⚠ SCENE DEPTH IS THE WHOLE POINT, AND ONE COLLECTION IS WORTH NOTHING.
// Holding an NFT does not mean buying it: anyone can send you one and you cannot
// refuse. That is exactly what sank the anna6900 lead — a 27-holder ERC-1155 whose
// recipients included SPX ranks 1, 2 and 5 looked spectacular until the transfer log
// showed every single token was minted and hand-sent by ONE wallet, and not one
// recipient has ever moved theirs. Receiving is not choosing.
//   Requiring N>=3 independent collections is what makes this robust. Being gifted
// into three SPECIFIC collections of 216-1,135 holders each is not something that
// happens by accident; being gifted into one is Tuesday.
//
// ⚠ SPAM WOULD HAVE DESTROYED THIS. Of the 37 "collections" case #2451 appears in on
// Base, only about four are real. The rest are unsolicited drops sprayed at every
// active wallet — PYUSD Airdrop PASS (2,003,918 holders), HYPERLIQUID DROP (1,245,319),
// SUI Exclusive Drop (1,366,723), "t.ly/claimcake - 135.000$ Win", "5O OOO USD FOR
// FREE". Intersecting those yields millions of fake co-members. The signal here is
// almost entirely MAINNET; Base contributes Kemonokaki and little else.
//
// ⚠ NEVER COUNT NFTs FROM THE EXPLORER'S PAGINATED LIST. A wallet holding 247 NFTs
// across 50+ collections pushed AEON outside the page window and the list reported
// 0 AEON for 0xf3d9281f, which actually holds 3. Balances come from balanceOf.
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const R = p => JSON.parse(readFileSync(new URL(p, ROOT), "utf8"));
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=")[1] ?? d;

const BS = { eth: "https://eth.blockscout.com/api/v2", base: "https://base.blockscout.com/api/v2" };
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://rpc.flashbots.net"];
export const AEON = "0xc374a204334d4edd4c6a62f0867c752d65e9579c";

/** A collection is spam if it advertises, or if it is too big to mean anything.
 *  Both halves are needed: "zkSync Drop" passes a name check on some listings but
 *  1,267,582 holders is not a community, and "5O OOO USD FOR FREE" has only 1,001. */
export const SPAM_NAME = /(\.io|\.com|\.net|\.finance|t\.ly|t\.me|https?:|\$|\bwin\b|free|reward|drop\b|scan |claim|airdrop|bounty|auto(eth|wbtc)|voucher|giveaway|\d{3},\d{3}|USD)/i;
export const SPAM_HOLDERS = 60000;
export const isSpam = (name, holders) => SPAM_NAME.test(name || "") || (holders || 0) > SPAM_HOLDERS;

// Blockscout rate-limits a long sweep. A 429 that returns null looks EXACTLY like an
// empty collection, and the first run of this script duly reported 0 holders for
// Kemonokaki, anna6900 and every Base collection — then ranked candidates off the
// remains as though nothing were missing. Back off hard, and see completeness() below:
// a short read must fail loudly, never silently shrink the scene.
const j = async u => {
  for (let i = 0; i < 9; i++) {
    try {
      const r = await fetch(u, { headers: { accept: "application/json" } });
      if (r.ok) return r.json();
      if (r.status !== 429 && r.status < 500) return null;      // a real 404 is an answer
    } catch {}
    await new Promise(x => setTimeout(x, Math.min(8000, 600 * 2 ** i)));
  }
  return null;
};

/** A holder sweep is trusted only if it reaches the count the token itself reports.
 *  Anything under this is a truncated read, not a small collection. */
export const COMPLETE_FRAC = 0.97;
export const isComplete = (fetched, expected) =>
  !expected ? fetched > 0 : fetched >= Math.floor(expected * COMPLETE_FRAC);

/** ERC-721 balanceOf, read from the contract. The only count we trust. */
export async function balanceOf(contract, addr) {
  const data = "0x70a08231" + addr.slice(2).padStart(64, "0");
  for (const r of RPCS) {
    try {
      const d = await (await fetch(r, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: contract, data }, "latest"] }) })).json();
      if (d?.result) return Number(BigInt(d.result));
    } catch {}
  }
  return null;
}

async function pageAll(url, pick) {
  const out = []; let p = null;
  for (let n = 0; n < 600; n++) {
    const d = await j(url + (p ? (url.includes("?") ? "&" : "?") + new URLSearchParams(p) : ""));
    if (!d) break;
    for (const it of d.items || []) pick(out, it);
    if (!d.next_page_params) break;
    p = d.next_page_params;
  }
  return out;
}

/** Every NFT collection the seed wallets hold, with the spam already labelled. */
export async function sceneOf(wallets) {
  const m = new Map();
  for (const w of wallets) for (const [chain, B] of Object.entries(BS)) {
    const d = await j(`${B}/addresses/${w}/nft/collections?type=ERC-721,ERC-1155`);
    for (const it of d?.items || []) {
      const t = it.token || {}, addr = (t.address_hash || "").toLowerCase();
      if (!addr) continue;
      const k = `${chain}|${addr}`;
      if (!m.has(k)) m.set(k, { chain, addr, name: t.name || "?", type: t.type,
        holders: Number(t.holders_count) || 0, spam: isSpam(t.name, Number(t.holders_count) || 0), seeds: [] });
      m.get(k).seeds.push(w);
    }
  }
  return [...m.values()];
}

export const holdersOf = (chain, addr) =>
  pageAll(`${BS[chain]}/tokens/${addr}/holders`, (out, h) => {
    const a = (h.address?.hash || h.address || "").toLowerCase(); if (a) out.push(a);
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  const token = Number(arg("case", 2451)), MIN = Number(arg("min", 3));
  const reg = R("research/pfp-forensics/cases.json");
  const kase = reg.cases.find(c => c.token === token);
  if (!kase) throw new Error(`no case #${token}`);
  const seeds = [...new Set([...(kase.wallets || []), kase.trader, kase.nftHolder].filter(Boolean).map(a => a.toLowerCase()))];

  // every wallet already attributed to ANY case is excluded from the results
  const traced = new Map();
  for (const c of reg.cases) for (const a of [...(c.wallets || []), ...(c.nftCustody || []), c.trader, c.nftHolder].filter(Boolean))
    traced.set(a.toLowerCase(), c.token);

  const whales = R("public/whales.json"), baseCh = R("public/base-onchain.json");
  const eth = new Map(whales.wallets.map(w => [w.a.toLowerCase(), w]));
  const base = new Map(baseCh.wallets.map(w => [w.a.toLowerCase(), w]));

  console.error(`seed case #${token}: ${seeds.length} wallets`);
  const all = await sceneOf(seeds);
  const scene = all.filter(c => !c.spam);
  console.error(`collections: ${all.length} total, ${all.length - scene.length} spam, ${scene.length} kept`);

  const depth = new Map(), short = [];
  for (const c of scene) {
    let hs = await holdersOf(c.chain, c.addr);
    if (!isComplete(hs.length, c.holders)) {                      // one retry, slowly
      await new Promise(x => setTimeout(x, 5000));
      const again = await holdersOf(c.chain, c.addr);
      if (again.length > hs.length) hs = again;
    }
    c.holderCount = hs.length;
    c.complete = isComplete(hs.length, c.holders);
    if (!c.complete) short.push(c);
    for (const a of hs) { if (!depth.has(a)) depth.set(a, []); depth.get(a).push(c.name); }
    console.error(`  ${c.complete ? " " : "!"} ${c.name.slice(0, 28).padEnd(29)} ${String(hs.length).padStart(6)} / ${String(c.holders).padStart(6)} holders`);
    await new Promise(x => setTimeout(x, 300));
  }
  if (short.length) {
    console.error(`\n!! ${short.length} collection(s) read short — the scene is INCOMPLETE and candidates are undercounted:`);
    for (const c of short) console.error(`   ${c.chain} ${c.name}: got ${c.holderCount} of ${c.holders}`);
    if (process.argv.includes("--write"))
      throw new Error(`refusing to --write a truncated scene (${short.length} short). Re-run; the reads are rate-limited, not empty.`);
  }

  const candidates = [];
  for (const [a, cols] of depth) {
    const e = eth.get(a), b = base.get(a);
    if ((!e && !b) || cols.length < MIN || traced.has(a)) continue;
    candidates.push({ a, scene: cols.length, collections: cols,
      spxEth: e ? Math.round(e.bal) : 0, spxBase: b ? Math.round(b.bal) : 0, heldDays: e?.days ?? b?.days ?? null });
  }
  candidates.sort((x, y) => y.scene - x.scene || (y.spxEth + y.spxBase) - (x.spxEth + x.spxBase));
  for (const c of candidates.slice(0, 12)) c.aeon = await balanceOf(AEON, c.a);   // verified, not listed

  const out = { what: "Wallets sharing a traced case's NFT collections that also hold SPX. Leads, not conclusions.",
    ran: new Date().toISOString().slice(0, 10), seedCase: token, minScene: MIN,
    spxAsOf: whales.updated, spot: whales.spot,
    caveat: "Holding is not buying — anyone can send an NFT and it cannot be refused. Scene depth >= 3 independent collections is what makes a row meaningful; a single shared collection is noise. AEON counts are balanceOf, never the explorer's paginated list.",
    complete: short.length === 0,
    scene: scene.map(({ chain, addr, name, holders, holderCount, complete }) => ({ chain, addr, name, holders, holderCount, complete })),
    spamDropped: all.filter(c => c.spam).map(({ chain, name, holders }) => ({ chain, name, holders })),
    candidates };

  console.log(`\n${candidates.length} candidates with scene >= ${MIN}, holding ${candidates.reduce((s, c) => s + c.spxEth + c.spxBase, 0).toLocaleString()} SPX`);
  for (const c of candidates.slice(0, 20))
    console.log(`  ${String(c.scene).padStart(3)}  ${c.a}  ETH ${String(c.spxEth).padStart(11)}  BASE ${String(c.spxBase).padStart(9)}  AEON ${c.aeon ?? "-"}  ${c.collections.slice(0, 5).join(", ")}`);
  if (process.argv.includes("--write")) {
    const p = new URL(`research/pfp-forensics/scene-${token}.json`, ROOT);
    writeFileSync(p, JSON.stringify(out, null, 2) + "\n");
    console.log(`\n-> research/pfp-forensics/scene-${token}.json`);
  }
}
