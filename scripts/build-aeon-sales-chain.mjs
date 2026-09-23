// ============================================================================
// PROJECT AEON — sales straight from the chain (replaces the Dune sales pull)
// ============================================================================
//   node scripts/build-aeon-sales-chain.mjs                 append new sales to dune/out/aeon_sales.csv
//   node scripts/build-aeon-sales-chain.mjs --validate --since=2026-07-23 --until=2026-09-23
//                                                           decode a window and diff it against Dune
//
// Dune moved sales data behind payment in September 2026. Every AEON sale is an ordinary Ethereum
// transaction — the NFT moves one way and ETH (or wrapped ETH) the other — so it can be decoded from
// public chain data with no key: Blockscout's free API for the transfers and each transaction's legs,
// and Blockscout's daily ETH close for the USD value. Output is the SAME CSV Dune produced
// (time,token_id,price,currency_symbol,price_usd,marketplace,buyer,seller,tx_hash), appended to the
// committed archive, so build-aeon-sales / -market / -traders read it unchanged.
//
// A SALE is an AEON transfer (not a mint) whose buyer paid in the same transaction:
//   • accepted bid   — WETH or Blur Pool ETH moved FROM the buyer (the bidder). Gross = everything the
//                      buyer sent in that token (seller proceeds + fees + royalty), split across the NFTs
//                      that buyer received in the tx.
//   • bought outright — the buyer sent the transaction with ETH attached. Gross = tx value MINUS any ETH
//                      the marketplace refunded to the buyer inside the tx (Seaport returns overpayment),
//                      split across every NFT that buyer received in the tx (a sweep pays for all of them).
//   • smart wallet    — an ERC-4337 account buys through a relayer (EntryPoint.handleOps), so no ETH is
//                      attached; the payment is ETH the buyer's own wallet sends inside the tx.
//   No payment from the buyer → a gift or a wallet move, never a sale.
// Heuristic, not a marketplace ABI decoder: a sweep that mixes prices gets the average, and an aggregator
// buying on someone else's behalf is caught only through the ETH path. --validate measures the gap.
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const AEON = "0xc374a204334d4edd4c6a62f0867c752d65e9579c";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const BLUR_POOL = "0x0000000000a39bb272e79075ade125fd351887ac";
const ZERO = "0x0000000000000000000000000000000000000000";
const BS = "https://eth.blockscout.com/api/v2";
const CSV = "dune/out/aeon_sales.csv";
const STATUS = "public/aeon-dune-status.json";   // the heartbeat the feed audit already reads (name kept)
const HEADER = "time,token_id,price,currency_symbol,price_usd,marketplace,buyer,seller,tx_hash";
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const lc = s => (s || "").toLowerCase();

// Routers by address first (Blockscout names can be missing), then by the contract's name.
const VENUE = {
  "0x00000000000000adc04c56bf30ac9d3c0aaf14dc": "opensea", "0x0000000000000068f116a894984e2db1123eb395": "opensea",
  "0x00000000006c3852cbef3e08e8df289169ede581": "opensea", "0x000000000000ad05ccc4f10045630fb830b95127": "blur",
  "0xb2ecfe4e4d61f8790bbb9de2d1259b9e2410cea5": "blur", "0x39da41747a83aee658334415666f3ef92dd0d541": "blur",
  "0x29469395eaf6f95920e59f858042f0e28d98a20b": "blur",
};
export function venueOf(to, name) {
  if (VENUE[lc(to)]) return VENUE[lc(to)];
  if (/seaport|opensea/i.test(name || "")) return "opensea";
  if (/blur/i.test(name || "")) return "blur";
  if (/sudo|lssvm|pair/i.test(name || "")) return "sudoswap";
  if (/magic ?eden/i.test(name || "")) return "magiceden";
  return "other";
}

const NFT_TYPES = /ERC-721|ERC-1155|ERC-404/;

/**
 * Decode one transaction into AEON sales. Pure.
 * @param tx   {from, to, toName, value (wei string), ts}
 * @param legs Blockscout token-transfer items for the tx: {from, to, token, type, value, id}
 * @returns [{time, id, price, currency, market, buyer, seller, tx}]
 */
export function decodeSales(txHash, tx, legs, internal = []) {
  const aeon = legs.filter(l => l.token === AEON && l.from !== ZERO && NFT_TYPES.test(l.type));
  if (!aeon.length) return [];
  const nftsTo = new Map();
  for (const l of legs) if (NFT_TYPES.test(l.type) && l.from !== ZERO) nftsTo.set(l.to, (nftsTo.get(l.to) || 0) + 1);
  const erc20From = (who, token) => legs.filter(l => l.token === token && l.from === who).reduce((s, l) => s + l.value, 0);
  const txEth = Number(BigInt(tx.value || "0")) / 1e18;
  const market = venueOf(tx.to, tx.toName);
  const out = [];
  for (const l of aeon) {
    const n = nftsTo.get(l.to) || 1;
    let price = 0, currency = "ETH";
    const weth = erc20From(l.to, WETH), pool = erc20From(l.to, BLUR_POOL);
    if (weth > 0) { price = weth / n; currency = "WETH"; }
    else if (pool > 0) { price = pool / n; currency = "ETH"; }
    else if (txEth > 0 && tx.from === l.to) {
      const refund = internal.filter(i => i.to === l.to).reduce((a, i) => a + i.eth, 0);
      price = Math.max(0, txEth - refund) / n;
    } else {
      const sent = internal.filter(i => i.from === l.to).reduce((a, i) => a + i.eth, 0);   // smart wallet
      if (sent > 0) price = sent / n;
    }
    if (!(price > 0)) continue;                                     // no payment by the buyer: not a sale
    out.push({ time: tx.ts, id: l.id, price: +price.toFixed(6), currency, market, buyer: l.to, seller: l.from, tx: txHash });
  }
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(path) {
  for (let i = 0; i < 8; i++) {
    // 20 s per attempt: a request that never answers must fail and retry, not hang the whole run
    try { const r = await fetch(BS + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) }); if (r.ok) return await r.json(); if (r.status === 404) return null; }
    catch { /* retry */ }
    await sleep(Math.min(12000, 600 * 2 ** i));
  }
  throw new Error("blockscout unreachable: " + path.slice(0, 80));
}
const normLeg = t => ({ from: lc(t.from?.hash), to: lc(t.to?.hash), token: lc(t.token?.address_hash || t.token?.address),
  type: t.token?.type || "", id: t.total?.token_id != null ? Number(t.total.token_id) : null,
  value: t.total?.value && t.total?.decimals ? Number(t.total.value) / 10 ** Number(t.total.decimals) : 0 });

/** AEON transfer txs newer than `afterMs` (and not newer than `untilMs`), newest first → unique hashes. */
async function recentTxs(afterMs, untilMs = Infinity) {
  const txs = new Map(); let p = null;
  for (let page = 0; page < 400; page++) {
    const d = await get(`/tokens/${AEON}/transfers` + (p ? "?" + new URLSearchParams(p) : ""));
    let older = false;
    for (const t of d?.items || []) {
      const ts = Date.parse(t.timestamp);
      if (ts <= afterMs) { older = true; break; }
      if (ts <= untilMs) txs.set(t.transaction_hash, t.timestamp);
    }
    if (older || !d?.next_page_params) return txs;
    p = d.next_page_params;
  }
  throw new Error("more than 400 pages of AEON transfers — refusing to guess a cutoff");
}

async function decodeTx(hash, ts) {
  const tx = await get(`/transactions/${hash}`);
  const legs = [];
  let p = null;
  for (let i = 0; i < 20; i++) {
    const d = await get(`/transactions/${hash}/token-transfers` + (p ? "?" + new URLSearchParams(p) : ""));
    legs.push(...(d?.items || []).map(normLeg));
    if (!d?.next_page_params) break;
    p = d.next_page_params;
  }
  // Internal ETH movements, only when the ETH path needs them: refunds to a buyer who attached ETH,
  // or a smart wallet paying from inside the transaction. Most bid sales never need this call.
  const from = lc(tx?.from?.hash), aeonTo = new Set(legs.filter(l => l.token === AEON).map(l => l.to));
  const paidInToken = [...aeonTo].some(b => legs.some(l => (l.token === WETH || l.token === BLUR_POOL) && l.from === b));
  let internal = [];
  if (!paidInToken && (BigInt(tx?.value || "0") > 0n || ![...aeonTo].includes(from))) {
    let q = null;
    for (let i = 0; i < 10; i++) {
      const d = await get(`/transactions/${hash}/internal-transactions` + (q ? "?" + new URLSearchParams(q) : ""));
      internal.push(...(d?.items || []).map(x => ({ from: lc(x.from?.hash), to: lc(x.to?.hash), eth: Number(BigInt(x.value || "0")) / 1e18 })));
      if (!d?.next_page_params) break;
      q = d.next_page_params;
    }
  }
  return decodeSales(hash, { from, to: lc(tx?.to?.hash), toName: tx?.to?.name || "", value: tx?.value || "0", ts }, legs, internal);
}

async function ethCloses() {
  const d = await get("/stats/charts/market");
  return new Map((d?.chart_data || []).map(r => [r.date, Number(r.closing_price)]));
}
const rateOn = (closes, day) => { for (let t = Date.parse(day); t > Date.parse(day) - 10 * 864e5; t -= 864e5) { const v = closes.get(new Date(t).toISOString().slice(0, 10)); if (v > 0) return v; } return 0; };
const csvTime = iso => iso.replace("T", " ").replace(/\.\d+Z$|Z$/, "").slice(0, 19) + ".000 UTC";
const toRow = (s, closes) => [csvTime(s.time), s.id, s.price, s.currency, +(s.price * rateOn(closes, s.time.slice(0, 10))).toFixed(4),
  s.market, s.buyer, s.seller, s.tx].join(",");

async function decodeWindow(afterMs, untilMs) {
  const txs = await recentTxs(afterMs, untilMs);
  // A transaction Blockscout will not serve even after retries is recorded, not fatal: a free API has
  // outages, and one unreadable transaction must not freeze every sale after it.
  const sales = [], failed = [], todo = [...txs];
  let i = 0;
  const worker = async () => {                                     // 4 at a time: polite to a free API
    while (todo.length) {
      const [hash, ts] = todo.shift();
      try { sales.push(...await decodeTx(hash, ts)); }
      catch (e) { failed.push({ hash, ts }); console.error(`  could not read ${hash.slice(0, 12)}… (${e.message.slice(0, 40)})`); }
      if (++i % 25 === 0) console.error(`  ${i}/${txs.size} transactions`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return { txs: txs.size, failed, sales: sales.sort((a, b) => a.time.localeCompare(b.time)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--validate")) {
    // Diff a window against what Dune reported. Ground truth = the site files built from Dune:
    // aeon-sales.json daily counts + volume, and its per-trade list for the last 30 days.
    const since = arg("since", "2026-07-23"), until = arg("until", "2026-09-23");
    const { txs, sales, failed } = await decodeWindow(Date.parse(since + "T23:59:59Z"), Date.parse(until + "T00:00:00Z"));
    if (failed.length) console.log(`  ⚠ ${failed.length} transaction(s) unreadable after retries — excluded from the comparison`);
    const truth = JSON.parse(readFileSync("public/aeon-sales.json", "utf8"));
    const days = truth.daily.filter(r => r.d > since && r.d < until);
    const tN = days.reduce((a, r) => a + r.sales, 0), tV = days.reduce((a, r) => a + r.volEth, 0);
    const oV = sales.reduce((a, s) => a + s.price, 0);
    console.log(`window ${since} → ${until}: ${txs} AEON transactions`);
    console.log(`  Dune:  ${tN} sales · ${tV.toFixed(2)} ETH`);
    console.log(`  chain: ${sales.length} sales · ${oV.toFixed(2)} ETH`);
    const trades = (truth.trades || []).filter(t => t.d > since && t.d < until);
    const key = (id, d) => `${id}|${d}`;
    const mine = new Map(sales.map(s => [key(s.id, s.time.slice(0, 10)), s]));
    let hit = 0, close = 0; const miss = [], off = [];
    for (const t of trades) {
      const s = mine.get(key(t.token, t.d));
      if (!s) { miss.push(t); continue; }
      hit++;
      if (Math.abs(s.price - t.eth) <= Math.max(0.005, 0.02 * t.eth)) close++; else off.push({ id: t.token, d: t.d, dune: t.eth, chain: s.price, mkt: s.market });
    }
    console.log(`  per-trade (Dune's last-30-day list, ${trades.length}): found ${hit} · price within 2% ${close}`);
    for (const m of miss.slice(0, 10)) console.log(`    missed #${m.token} ${m.d} ${m.eth} ETH`);
    for (const o of off.slice(0, 10)) console.log(`    price off #${o.id} ${o.d} dune ${o.dune} chain ${o.chain} (${o.mkt})`);
    const byMkt = {}; for (const s of sales) byMkt[s.market] = (byMkt[s.market] || 0) + 1;
    console.log(`  venues: ${JSON.stringify(byMkt)}`);
    process.exit(0);
  }

  const lines = existsSync(CSV) ? readFileSync(CSV, "utf8").trim().split("\n") : [HEADER];
  const body = lines.slice(1);
  const lastMs = body.reduce((m, l) => Math.max(m, Date.parse(l.slice(0, 19).replace(" ", "T") + "Z") || 0), 0);
  const seen = new Set(body.map(l => { const c = l.split(","); return c[8] + "|" + c[1]; }));
  try {
    console.error(`aeon-sales-chain: decoding sales after ${new Date(lastMs).toISOString()}…`);
    const [{ txs, sales, failed }, closes] = await Promise.all([decodeWindow(lastMs), ethCloses()]);
    // If any transaction could not be read, keep only sales OLDER than the earliest failure. The archive's
    // last timestamp then stops short of it, so the next run starts there and reads it again — a gap
    // can never be sealed behind a newer sale.
    const wall = failed.length ? Math.min(...failed.map(f => Date.parse(f.ts))) : Infinity;
    if (failed.length) console.error(`aeon-sales-chain: ${failed.length} unreadable transaction(s) — holding back sales from ${new Date(wall).toISOString()} on for the next run`);
    const fresh = sales.filter(s => !seen.has(s.tx + "|" + s.id) && Date.parse(s.time) < wall);
    const all = [...body, ...fresh.map(s => toRow(s, closes))].sort();
    writeFileSync(CSV, [HEADER, ...all].join("\n") + "\n");
    const newest = all.length ? all.at(-1).slice(0, 10) : null;
    writeFileSync(STATUS, JSON.stringify({ updated: newest, checked: new Date().toISOString().slice(0, 10), ok: true, pulled: "sales", source: "chain (Blockscout)" }));
    console.error(`aeon-sales-chain: ${txs} AEON transactions → +${fresh.length} sales → ${all.length.toLocaleString()} rows · newest ${newest}`);
  } catch (e) {
    // Soft: a failed read leaves the archive untouched, and the heartbeat's data date stays honest.
    console.error(`aeon-sales-chain: ${e.message} — archive unchanged`);
    process.exit(0);
  }
}
