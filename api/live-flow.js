// LIVE whale flow — near-real-time net SPX movement of the watched wallets, fetched on view
// (not on a cron) so the board is fresh when someone opens it, and edge-cached ~60s so many
// viewers share one Alchemy pull. This is the FAST layer: it detects who moved in the last few
// hours within minutes of the block. The DEEP layer (cost basis, profit/loss, holder age) stays
// the daily FIFO reconstruction — the board reads that from whales.json for the baseline and
// overlays these live moves on top.
//
// Graceful by design: no ALCHEMY_KEY or any upstream hiccup → {moves:[], error} with 200, so the
// board still renders its wallets (from whales.json) with just no live pulse.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kvConnected, cmd, getJSON, setRaw } from "../lib/kv.mjs";

// ⚠ ONE SHARED COPY + A MONTHLY BUDGET (2026-09-27). Pulled on view with a 3-minute per-REGION edge cache,
// this endpoint's Alchemy cost grew with traffic (hundreds of heavy pulls on a busy day), and the account
// was on Pay-As-You-Go. The key now lives on a FREE plan (30M CU/month, hard cap — hitting it pauses every
// Alchemy job, not just this one). So: the live copy is kept ONCE in KV and refreshed at most every
// LIVEFLOW_REFRESH_MIN (30) minutes for everyone; a lock lets only one visitor trigger a pull; each pull's
// estimated CU is added to a monthly counter, and past LIVEFLOW_CU_BUDGET (10M — a third of the plan) it
// stops pulling and serves its last copy until the month turns. The daily jobs keep the other two thirds.
const REFRESH_MIN = () => Number(process.env.LIVEFLOW_REFRESH_MIN || 30);
const BUDGET_CU = () => Number(process.env.LIVEFLOW_CU_BUDGET || 10e6);
const CACHE_KEY = "liveflow:v1", LOCK_KEY = "liveflow:lock";
// Alchemy compute units per call, rounded UP (so the budget errs on the safe side)
const CU = { alchemy_getAssetTransfers: 150, eth_blockNumber: 10, getSlot: 10, getAccountInfo: 20, getTokenAccountsByOwner: 20 };
const meter = { cu: 0 };
const charge = method => { meter.cu += CU[method] ?? 30; };
export const monthKey = (d = new Date()) => "liveflow:cu:" + d.toISOString().slice(0, 7);
/** What to do with a request. Pure; unit-tested.
 *  serve  = the shared copy is fresh; pull = refresh from Alchemy; paused = the month's budget is spent */
export function liveFlowDecision({ cached, now, refreshMs, spent, budget }) {
  if (cached?.updated && now - Date.parse(cached.updated) < refreshMs) return "serve";
  if (spent >= budget) return "paused";
  return "pull";
}

const SPX = "0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c"; // SPX6900 ERC-20 (Ethereum), 8 decimals
const DAYS_DEFAULT = 7;
const LIVE_HOURS = 6;                                       // the "moving right now" sub-window
const BLOCKS_PER_HOUR = 300, BLOCKS_PER_DAY = 7200;         // ~12s blocks (Ethereum defaults)
const TOP_N = 800;                                          // watch ALL ≥100k holders (~575) — the transfer

// EVM chains watched for live flow. Same Alchemy key, same getAssetTransfers mechanism; only the
// endpoint, SPX contract, whale source and BLOCK TIME differ (Base ~2s vs ETH ~12s → different
// blocks per hour/day, which the window + day-bucketing depend on). Solana is NOT here — it's
// non-EVM (getAssetTransfers is EVM-only) and stays on its daily 30-day flow.
const CHAINS = {
  eth:  { alchemy: "eth-mainnet",  spx: SPX,                                          whales: "public/whales.json",       bph: 300,  bpd: 7200 },
  base: { alchemy: "base-mainnet", spx: "0x50da645f148798f68ef2d7db7c1cb22a6819bb2c", whales: "public/base-onchain.json", bph: 1800, bpd: 43200 },
};
                                                            // window is pulled once and filtered locally, so a
                                                            // bigger watched set costs nothing extra on Alchemy

// Per-WATCHED-wallet footprint over the window: net flow, the last-`liveHours` sub-total (the live
// pulse), and how many distinct days it was active / selling — so a wallet slowly offloading across
// several days is earmarked and stays listed even on a quiet day, and a repeat sell reads as a
// pattern. Pure + exported for unit tests. `value` is already decimal-adjusted; `blockNum` is the hex
// block, which we bucket into days (no per-transfer timestamp fetch needed).
export function aggregateWindow(transfers, watched, latestBlock, opts = {}) {
  const liveHours = opts.liveHours ?? LIVE_HOURS;
  const bph = opts.bph ?? BLOCKS_PER_HOUR, bpd = opts.bpd ?? BLOCKS_PER_DAY;   // per-chain block time
  const liveFrom = latestBlock - liveHours * bph;
  const stat = new Map();    // a -> {net, live, lastBn, days: Map(dayBucket -> net)}
  const bump = (a, v, bn) => {
    let s = stat.get(a);
    if (!s) { s = { net: 0, live: 0, lastBn: 0, days: new Map() }; stat.set(a, s); }
    s.net += v;
    if (bn >= liveFrom) s.live += v;
    if (bn > s.lastBn) s.lastBn = bn;
    const bucket = Math.floor((latestBlock - bn) / bpd);
    s.days.set(bucket, (s.days.get(bucket) || 0) + v);
  };
  for (const t of transfers || []) {
    const v = Number(t.value) || 0; if (!v) continue;
    const bn = parseInt(t.blockNum, 16); if (!Number.isFinite(bn)) continue;
    const from = (t.from || "").toLowerCase(), to = (t.to || "").toLowerCase();
    if (watched.has(from)) bump(from, -v, bn);
    if (watched.has(to)) bump(to, v, bn);
  }
  const out = [];
  for (const [a, s] of stat) {
    if (Math.abs(s.net) < 1) continue;                     // net-flat over the window → not earmarked
    let activeDays = 0, sellDays = 0, buyDays = 0;
    for (const dn of s.days.values()) if (Math.abs(dn) >= 1) { activeDays++; if (dn < 0) sellDays++; else buyDays++; }
    out.push({
      a, net: Math.round(s.net), live: Math.round(s.live),
      activeDays, sellDays, buyDays, agoBlocks: Math.max(0, latestBlock - s.lastBn),
    });
  }
  out.sort((x, y) => x.net - y.net);                        // biggest NET SELLERS first
  return out;
}

const readJson = p => { try { return JSON.parse(readFileSync(join(process.cwd(), p), "utf8")); } catch { return null; } };

// ── Solana (non-EVM) via Alchemy Account Archive ──────────────────────────────────────────────────
// getAssetTransfers is EVM-only, but Account Archive answers getAccountInfo at any past slot, so we
// read each whale's SPX balance NOW and at a past slot and diff → net flow, same Alchemy key. The
// whale SET is the daily reconstruction (solana-onchain.json, grows as wallets cross 100k); the flow
// is live. ~3 cheap RPC calls per whale, batched. Solana addresses are base58 (CASE-SENSITIVE — never
// lowercased). Amount lives at offset 64 (SPL token account: mint 0-32 | owner 32-64 | amount 64-72).
const SOL_MINT = "J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr";
const SOL_DEC = 8, SOL_SPH = 9000, SOL_SPD = 216000;   // ~2.5 slots/sec → per hour / per day
const solAmount = d => { try { return Number(Buffer.from(d[0], "base64").readBigUInt64LE(0)) / 10 ** SOL_DEC; } catch { return null; } };

async function rpcBatch(url, calls) {
  for (const c of calls) charge(c.method);
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(calls.map((c, i) => ({ id: i, jsonrpc: "2.0", method: c.method, params: c.params }))) });
  if (!res.ok) throw new Error(`batch ${res.status}`);
  const out = new Array(calls.length);
  for (const r of await res.json()) out[r.id] = r;          // full entry {result, error} — callers must
  return out;                                               // distinguish a missing (error) read from a real value:null
}

// Solana live flow needs Account Archive's historical `slot` param on getAccountInfo. That param is
// gated to Alchemy's Pay-As-You-Go+ tier — on Free it errors per call. When that happens every
// wallet's baseline is unknown, so we honestly emit NOTHING (never fabricate a full-balance move)
// and the board falls back to the daily 30-day reconstruction. The instant the key is on PAYG this
// lights up live with no code change.
async function solanaFlow(key, days, liveHours) {
  const owners = (readJson("public/solana-onchain.json")?.wallets || [])
    .filter(w => w?.a && w.bal >= 1e5).sort((a, b) => b.bal - a.bal).slice(0, TOP_N).map(w => w.a);
  if (!owners.length) return [];
  const url = `https://solana-mainnet.g.alchemy.com/v2/${key}`;
  const slot = await rpc(url, "getSlot", []);
  const past7 = Math.max(0, slot - days * SOL_SPD), pastLive = Math.max(0, slot - liveHours * SOL_SPH);

  // PROBE Account Archive ONCE before the per-whale historical reads. The historical `slot` param is a
  // paid Alchemy tier; on a Free/non-PAYG key EVERY per-whale getAccountInfo 400s (-32600). Firing all
  // ~575×2 of them just to swallow the errors floods the Alchemy logs and burns CU for nothing. One
  // cheap probe on the mint tells us if the tier is available; if not, emit nothing (the board falls
  // back to the daily reconstruction) — and it auto-upgrades to live the instant the key gets PAYG.
  let archiveOk;
  try { const pr = await rpcBatch(url, [{ method: "getAccountInfo", params: [SOL_MINT, { encoding: "base64", dataSlice: { offset: 0, length: 8 }, slot: past7 }] }]); archiveOk = !pr[0]?.error; }
  catch { archiveOk = false; }
  if (!archiveOk) return [];

  // current SPX token account + balance per owner
  const cur = await rpcBatch(url, owners.map(o => ({ method: "getTokenAccountsByOwner", params: [o, { mint: SOL_MINT }, { encoding: "jsonParsed" }] })));
  const rows = owners.map((o, i) => {
    let bal = 0, ta = null;
    for (const a of cur[i]?.result?.value || []) { const ui = a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0; bal += ui; if (!ta || ui > 0) ta = a.pubkey; }
    return { o, ta, bal };
  }).filter(r => r.ta);
  if (!rows.length) return [];

  // historical balances at the 7-day and live slots (Account Archive) → diff. A read that ERRORED
  // (Free-tier gate / rate limit) is unknown — skip it rather than fabricate a full-balance move; a
  // successful value:null means the token account didn't exist then = a real zero (new buyer).
  const hist = s => rpcBatch(url, rows.map(r => ({ method: "getAccountInfo", params: [r.ta, { encoding: "base64", dataSlice: { offset: 64, length: 8 }, slot: s }] })));
  const [h7, hL] = await Promise.all([hist(past7), hist(pastLive)]);
  const out = [];
  rows.forEach((r, i) => {
    if (h7[i]?.error) return;                                          // 7-day baseline unknown → no honest net
    const p7 = solAmount(h7[i]?.result?.value?.data) ?? 0;
    const pl = hL[i]?.error ? p7 : (solAmount(hL[i]?.result?.value?.data) ?? 0);  // live read failed → assume flat since 7d
    const net = r.bal - p7, live = r.bal - pl;
    if (Math.abs(net) < 1) return;
    out.push({ a: r.o, chain: "sol", net: Math.round(net), live: Math.round(live), sellDays: net < 0 ? 1 : 0, activeDays: 1 });
  });
  return out.sort((a, b) => a.net - b.net);
}

async function rpc(url, method, params) {
  charge(method);
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  if (!res.ok) throw new Error(`${method} ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message || "rpc error"}`);
  return j.result;
}

// One chain's movers: pull its SPX-transfer window from Alchemy, filtered to its ≥100k whales.
async function chainFlow(id, cfg, key, days) {
  const whales = readJson(cfg.whales);
  const watched = new Set((whales?.wallets || []).filter(w => w?.a && w.bal >= 1e5)
    .sort((a, b) => b.bal - a.bal).slice(0, TOP_N).map(w => w.a.toLowerCase()));
  if (!watched.size) return [];
  const url = `https://${cfg.alchemy}.g.alchemy.com/v2/${key}`;
  const latest = parseInt(await rpc(url, "eth_blockNumber", []), 16);
  const fromBlock = "0x" + Math.max(0, latest - days * cfg.bpd).toString(16);
  const transfers = [];
  let pageKey;
  for (let p = 0; p < 25; p++) {
    const r = await rpc(url, "alchemy_getAssetTransfers", [{
      fromBlock, toBlock: "latest", contractAddresses: [cfg.spx], category: ["erc20"],
      withMetadata: false, excludeZeroValue: true, maxCount: "0x3e8", ...(pageKey ? { pageKey } : {}),
    }]);
    if (r?.transfers?.length) transfers.push(...r.transfers);
    pageKey = r?.pageKey;
    if (!pageKey) break;
  }
  return aggregateWindow(transfers, watched, latest, { liveHours: LIVE_HOURS, bph: cfg.bph, bpd: cfg.bpd })
    .map(w => ({ ...w, chain: id }));
}

// One full pull from Alchemy: every chain in parallel and isolated, so one erroring never kills the others.
// EVM chains use the getAssetTransfers window; Solana uses Account Archive (skips itself on a Free key).
async function pull(key, days, meta) {
  const jobs = [
    ...Object.entries(CHAINS).map(([id, cfg]) => ["evm:" + id, () => chainFlow(id, cfg, key, days)]),
    ["sol", () => solanaFlow(key, days, LIVE_HOURS)],
  ];
  const results = await Promise.allSettled(jobs.map(([, run]) => run()));
  const wallets = results.flatMap(r => (r.status === "fulfilled" ? r.value : []));
  const errors = results.map((r, i) => (r.status === "rejected" ? `${jobs[i][0]}: ${r.reason?.message || r.reason}` : null)).filter(Boolean);
  return { ...meta, wallets, ...(errors.length ? { errors } : {}) };
}

export default async function handler(req, res) {
  // The shared KV copy is the real limiter; the edge cache just spares KV (5 min per region).
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=900");
  // The window is FIXED: a ?days= value must not be able to force extra pulls past the shared copy.
  const days = DAYS_DEFAULT;

  // ALCHEMY_KEY must be set in the VERCEL env (production). A dashboard env change only applies to a
  // NEW deployment, so changing it requires a redeploy to take effect. One key covers ETH + Base + Solana.
  const key = process.env.ALCHEMY_KEY;
  const meta = { updated: new Date().toISOString(), days, liveHours: LIVE_HOURS, refreshMin: REFRESH_MIN() };
  if (!key) return res.status(200).json({ ...meta, wallets: [], error: "no ALCHEMY_KEY" });

  // No shared store: keep working, but only on the edge cache — lengthened so traffic can't multiply pulls.
  if (!kvConnected()) {
    res.setHeader("Cache-Control", `public, max-age=0, s-maxage=${REFRESH_MIN() * 60}, stale-while-revalidate=900`);
    return res.status(200).json(await pull(key, days, meta));
  }

  let cached, spent;
  try { cached = await getJSON(CACHE_KEY); spent = Number(await cmd("GET", monthKey())) || 0; }
  catch { return res.status(200).json({ ...meta, wallets: [], error: "store unavailable" }); }   // never pull blind
  const decision = liveFlowDecision({ cached, now: Date.now(), refreshMs: REFRESH_MIN() * 60e3, spent, budget: BUDGET_CU() });
  if (decision === "serve") return res.status(200).json({ ...cached, cache: "shared" });
  if (decision === "paused") return res.status(200).json({ ...(cached || { ...meta, wallets: [] }), cache: "stale", paused: "monthly Alchemy budget reached" });

  // Only one visitor refreshes; the rest get the last copy (or an empty "warming" answer the very first time).
  const got = await cmd("SET", LOCK_KEY, "1", "NX", "EX", "120").catch(() => null);
  if (got !== "OK") return res.status(200).json(cached ? { ...cached, cache: "stale" } : { ...meta, wallets: [], warming: true });

  meter.cu = 0;
  let body;
  try { body = await pull(key, days, meta); }
  finally {
    try { await cmd("INCRBY", monthKey(), String(Math.ceil(meter.cu))); await cmd("EXPIRE", monthKey(), String(40 * 86400)); } catch { /* counting is best-effort */ }
  }
  const failed = body.errors?.length && !body.wallets.length;
  if (!failed) { try { await setRaw(CACHE_KEY, JSON.stringify(body), 86400); } catch { /* serve it anyway */ } }
  await cmd("DEL", LOCK_KEY).catch(() => null);
  // A pull that failed outright (e.g. the plan's cap) keeps serving the last good copy.
  if (failed && cached) return res.status(200).json({ ...cached, cache: "stale", errors: body.errors });
  return res.status(200).json({ ...body, cache: "fresh", cu: Math.ceil(meter.cu) });
}
