// Liquid vs Illiquid Supply (SPX6900) — the standard, Glassnode-aligned "how much supply is
// actually likely to move" metric. NOT "free float" (for a fair-launch token ~88% is technically
// tradable → uninteresting), NOT "locked" (self-custody isn't locked). Definitions:
//   ILLIQUID = long-term holders, self-custody, held > 155 DAYS (Glassnode's empirical LTH bar).
//   LIQUID   = short-term holders (< 155d) + always-liquid supply (CEX + LP + custody).
// ⭐ SCOPE = ETH-native (holders + CEX/LP), which is directly comparable to Bitcoin (also single-chain).
// The ~109M Wormhole-bridged supply is NOT counted as illiquid (it isn't held by an ETH holder) NOR as
// liquid — it's left out of this ETH-native universe, along with the 69M burn. We tested whether that
// under- or over-states the whole-asset picture: the bridged supply is measured on its own chains
// (solana-onchain.json ≈ 91% held >155d, base-onchain.json ≈ 94%), i.e. AT LEAST AS STICKY as ETH's
// ~62%. So folding it in barely moves the number (~63%) — the ETH-native figure is a faithful proxy for
// the whole asset, not an artefact of dropping the bridge. Treating bridged as fully liquid (which we
// briefly did) was wrong: it's mostly long-held there too. Reproducible from heldTokens/liqEx/lth.

export function spxLiquidity(onchain) {
  return (onchain || [])
    .filter(r => Number.isFinite(r.heldTokens) && r.heldTokens > 0 && r.d)
    .map(r => {
      const lthPct = (r.lthProfit || 0) + (r.lthLoss || 0);   // % of holder supply held > 155d
      const illiq = r.heldTokens * lthPct / 100;              // long-term holder tokens
      const liqHolders = r.heldTokens - illiq;                // short-term holder tokens
      const liqEx = r.liqEx || 0;                             // CEX + LP + custody (always liquid)
      const liq = liqHolders + liqEx;
      const denom = illiq + liq || 1;
      return { ts: Date.parse(r.d), illiq, liq, illiqPct: 100 * illiq / denom, liqPct: 100 * liq / denom };
    })
    .filter(r => Number.isFinite(r.ts))
    .sort((a, b) => a.ts - b.ts);
}

// BTC illiquid over its history from the free BigQuery UTXO HODL bundle (BTC_HODL): the share
// held > 155 days. Bands = [0-1m, 1-3m, 3-6m, 6-12m, 1y+]; 155d ≈ 5.1 months, so >155d = all of
// 1y+ and 6-12m, plus the >155d slice of the 3-6m band (155-180 of the 90-180d band ≈ 27.8%).
const F36 = (180 - 155) / (180 - 90);
export function btcIlliquid(BTC_HODL) {
  return (BTC_HODL || [])
    .filter(r => Array.isArray(r[1]) && r[1].length === 5)
    .map(r => { const a = r[1]; return { ts: Date.parse(r[0]), illiqPct: a[4] + a[3] + a[2] * F36 }; })
    .filter(r => Number.isFinite(r.ts));
}
