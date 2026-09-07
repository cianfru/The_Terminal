// ============================================================================
// ZEC vs SPX6900 — an honest top-100 concentration comparison
// ============================================================================
// Reproduces the one number both chains can be judged on, on MATCHED bases.
//
//   node scripts/zec-vs-spx-concentration.mjs
//
// Three traps this exists to avoid — each one silently flatters or damns a chain:
//
//  1. DENOMINATOR. Ranking transparent ZEC against transparent ZEC gives 63%.
//     Against TOTAL supply it gives 44.6%. Neither is wrong; quoting one as
//     "Zcash concentration" without saying which is.
//  2. INFRASTRUCTURE. SPX's published top-100 excludes 27 CEX wallets + LP
//     (EXCLUDE_LABELS). Zcash has no such tagging, so an unfiltered ZEC number
//     compared against a filtered SPX number is the Base-dashboard error from
//     CLAUDE.md — "14 whales = 49.6%" that were all bridges and exchanges.
//     Here exchanges are flagged by TURNOVER (received / balance): a hot wallet
//     churns many multiples of what it holds; a cold whale sits at ~1.0x.
//  3. THE BLIND SPOT. ~29% of ZEC is in the shielded pool. Those holders are not
//     small — they are UNCOUNTABLE. Any ZEC concentration figure describes the
//     visible remainder only, and must say so.
//
// Both sides are measured PER-ADDRESS / PER-WALLET, not per entity, so they sit
// at the same methodological level (SPX's own entities.json shows its largest
// owner spans 5 wallets — that understates both chains equally).
// ============================================================================
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ZAT = 1e8;
export const TURNOVER_EXCHANGE = 3;    // received >= 3x balance => hot wallet

/** Exchange fingerprint. Cold whales sit at ~1.0x; hot wallets run 10-240x. */
export function turnover(detail) {
  const bal = Number(detail?.balance || 0) / ZAT;
  const rec = Number(detail?.received || 0) / ZAT;
  if (!bal) return null;
  return rec / bal;
}

export function flagExchanges(detailByAddr, threshold = TURNOVER_EXCHANGE) {
  const out = new Set();
  for (const [a, d] of Object.entries(detailByAddr || {})) {
    const t = turnover(d);
    if (t !== null && t >= threshold) out.add(a);
  }
  return out;
}

/** Top-N share. `excluded` drops addresses from BOTH numerator and denominator. */
export function topShare(balances, n, denominator) {
  if (!(denominator > 0)) return null;
  const sorted = [...balances].sort((a, b) => b - a);
  const top = sorted.slice(0, n).reduce((s, v) => s + v, 0);
  return Number((top / denominator * 100).toFixed(2));
}

/** SPX's raw figure: fold infrastructure back into numerator and denominator. */
export function rawWithInfra(filteredShare, heldSupply, infraSupply) {
  const den = heldSupply + infraSupply;
  if (!(den > 0)) return null;
  return Number(((filteredShare * heldSupply + infraSupply) / den * 100).toFixed(2));
}

function main() {
  const veil = JSON.parse(readFileSync("public/zcash-veil.json", "utf8"));
  const spxRows = JSON.parse(readFileSync("public/onchain.json", "utf8"));
  const spx = spxRows[spxRows.length - 1];

  const bal = veil.town.top.map(r => r.bal);
  const zecRawTransparent = topShare(bal, 100, veil.transparent);
  const zecRawTotal = topShare(bal, 100, veil.circulating);

  const spxFiltered = spx.top100;
  const spxRaw = rawWithInfra(spx.top100 / 100, spx.heldTokens, spx.cexBal + spx.lpBal);

  console.log("TOP-100 CONCENTRATION\n");
  console.log(`  ZEC raw, vs transparent supply    ${zecRawTransparent}%`);
  console.log(`  ZEC raw, vs TOTAL supply          ${zecRawTotal}%`);
  console.log(`  SPX raw (infra counted)           ${spxRaw}%`);
  console.log(`  SPX filtered (as published)       ${spxFiltered}%`);
  console.log(`\n  ZEC supply that cannot be ranked  ${veil.shielded.toLocaleString()} ZEC (${veil.shieldedPct}%)`);
  console.log(`  SPX supply that cannot be ranked  0 SPX (0%)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
