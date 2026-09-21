// ============================================================================
// KOL CLUSTER — the trade history of a tracked PFP household.
// ============================================================================
// Shared by the watcher and the card so the two can never print different numbers.
//
// Membership comes from research/pfp-forensics/cases.json, which is the registry the
// forensics work writes. One source of truth: re-clustering a case updates the bot.
//
// ⚠ CLASSIFY AT THE TRANSACTION LEVEL, never by counterparty. "A transfer to an SPX pool
// is a sale" is wrong twice: an LP MINT sends tokens straight to the pool and is not a
// sale (they come back), and an AGGREGATOR sell — CoW, 0x, 1inch, Paraswap — routes
// through a settlement contract and never looks like a transfer to a pool at all. On one
// wallet that shortcut reported 2,424,642 SPX sold against a true 839,674.
// ============================================================================
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REGISTRY = join(ROOT, "research/pfp-forensics/cases.json");
export const SPX = "0xE0f63A424a4439cBE457d80e4f4b51ad25b2c56C";
const BS = "https://eth.blockscout.com/api/v2";

/** SPX/WETH pairs. A transfer in or out of one of these crossed a market. */
export const POOLS = new Set([
  "0x00ed26e794b949e18b142f9108429b74ce08ac99", // Uniswap V3 SPX/WETH
  "0x52c77b0cb827afbad022e6d6caf2c44452edbc39", // Uniswap V2 SPX/WETH
  "0x6e7f25cb3d281d64dbe4b1a38072836adc11815f", // Uniswap V3 SPX/HPOS10I
  "0x7c706586679af2ba6d1a9fc2da9c6af59883fdd3", // Uniswap V3
]);
/** Routers and settlement contracts. The tokens reach a pool, but not from this wallet. */
export const ROUTERS = new Set([
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", // Uniswap UniversalRouter
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", // UniversalRouter 2
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff", // 0x Exchange Proxy (Blockscout mislabels this)
  "0x1111111254eeb25477b68fb85ed929f73a960582", // 1inch v5
  "0x111111125421ca6dc452d289314280a0f8842a65", // 1inch v6
  "0x9008d19f58aabd9ed0d60971565aa8510560ab41", // CoW Protocol
  "0xdef171fe48cf0115b1d80b88dc8eab59176fee57", // Paraswap
]);
const NPM = "0xc36442b4a4522e871399cd717abdd847ab11fe88"; // Uniswap V3 Positions NFT
const VENUE_NAME = /AugustusSwapper|ConveyorRouter|UniversalRouter|AggregationRouter|GPv2Settlement|ExchangeProxy/i;

const j = async (u, f = fetch) => { try { const r = await f(u, { headers: { accept: "application/json" } }); return r.ok ? r.json() : null; } catch { return null; } };

/** Members of a tracked case, from the registry. */
export function clusterOf(token, file = REGISTRY) {
  const reg = JSON.parse(readFileSync(file, "utf8"));
  const c = reg.cases.find(x => x.token === Number(token));
  if (!c) throw new Error(`no case #${token} in the registry`);
  // Read the machine-readable list. clusterNote writes addresses SHORT for readability, so a
  // regex over the prose found 2 of 6 wallets and silently tracked a third of the household.
  const wallets = [...new Set([...(c.wallets || []), c.trader, c.nftHolder]
    .filter(Boolean).map(a => a.toLowerCase()))];
  if (!wallets.length) throw new Error(`case #${token} has no wallets[]`);
  return { token: c.token, wallets, archetype: c.archetype, holdsNow: c.holdsNow };
}

/** What a transaction actually was. Pure; unit-tested.
 *
 *  ⚠ Key on WHERE THE TOKENS WENT (`cp`), not only on what the transaction called. A CoW
 *  Protocol order is signed off-chain and submitted by a third-party SOLVER, so `tx.to` is
 *  the solver's own contract — unknown, unverified, different every time — while the SPX
 *  still moves to GPv2Settlement. Keying on tx.to alone silently lost four real sells worth
 *  59,260 SPX on the first tracked cluster. The counterparty is the honest signal; tx.to is
 *  kept as a second chance for routes that proxy the token leg. */
export function classify({ dir, cp, txTo, txToName = "", txMethod = "" }) {
  const to = (txTo || "").toLowerCase(), other = (cp || "").toLowerCase();
  if (to === NPM || other === NPM) return txMethod === "mint" ? "lpOut" : "lpIn";  // round-trip, never a trade
  const venue = POOLS.has(other) || ROUTERS.has(other)
             || POOLS.has(to) || ROUTERS.has(to) || VENUE_NAME.test(txToName);
  return venue ? (dir === "IN" ? "buy" : "sell") : (dir === "IN" ? "in" : "out");
}

async function pages(path, max = 40, f = fetch) {
  let items = [], p = null;
  for (let i = 0; i < max; i++) {
    const u = BS + path + (p ? (path.includes("?") ? "&" : "?") + new URLSearchParams(p) : "");
    const d = await j(u, f); if (!d) break;
    items.push(...(d.items || []));
    if (!d.next_page_params) break;
    p = d.next_page_params;
  }
  return items;
}

/** Every SPX trade the household ever made, oldest first. Internal hops are not trades. */
export async function tradeHistory(wallets, { fetchImpl = fetch, sinceDays = null } = {}) {
  const set = new Set(wallets.map(a => a.toLowerCase()));
  const raw = [];
  for (const a of set) {
    for (const t of await pages(`/addresses/${a}/token-transfers?token=${SPX}`, 40, fetchImpl)) {
      const to = t.to?.hash?.toLowerCase(), from = t.from?.hash?.toLowerCase();
      if (set.has(to) && set.has(from)) continue;                 // internal hop
      raw.push({ wallet: a, ts: t.timestamp, tx: t.transaction_hash,
        dir: to === a ? "IN" : "OUT", qty: Number(t.total?.value) / 1e8,
        cp: to === a ? from : to });
    }
  }
  const byTx = new Map();
  for (const r of raw) {                                          // one swap can hit two pools
    const k = r.tx + r.wallet + r.dir;
    if (byTx.has(k)) byTx.get(k).qty += r.qty; else byTx.set(k, { ...r });
  }
  let rows = [...byTx.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  if (sinceDays) { const cut = Date.now() - sinceDays * 864e5; rows = rows.filter(r => Date.parse(r.ts) >= cut); }

  const meta = new Map();
  for (const tx of new Set(rows.map(r => r.tx))) {
    const t = await j(`${BS}/transactions/${tx}`, fetchImpl);
    meta.set(tx, { txTo: t?.to?.hash, txToName: t?.to?.name || "", txMethod: t?.method || "" });
  }
  return rows.map(r => ({ ...r, kind: classify({ dir: r.dir, cp: r.cp, ...meta.get(r.tx) }) }));
}

export const sells = rows => rows.filter(r => r.kind === "sell");
export const buys  = rows => rows.filter(r => r.kind === "buy");
