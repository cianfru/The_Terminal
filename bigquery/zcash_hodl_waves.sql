-- ============================================================================
-- ZCASH TRANSPARENT HODL WAVES, 2016 → now              [Google BigQuery, FREE]
-- ============================================================================
-- Supply-by-holding-age over time for Zcash's TRANSPARENT (t-address) supply,
-- from `bigquery-public-data.crypto_zcash`. Same event-based method as
-- bigquery/btc_hodl_waves.sql — Zcash is Bitcoin-derived, so transparent UTXO
-- age is EXACT, not a FIFO approximation.
--
-- ⚠⚠ WHY THIS QUERY EXISTS: a Blockchair-based reconstruction of the same thing
-- summed to 16.0M ZEC against ~12.0M transparent supply — 33.6% drift, cause
-- unknown, unpublishable. Here we build the UTXO set ourselves, so `total_zec`
-- below is a REAL check: if it does not land near transparent supply
-- (circulating − shielded ≈ 12.0M as of 2026-09), the output is wrong. Do not
-- publish any share from a run whose total does not reconcile.
--
-- ⚠⚠ THE ZCASH-SPECIFIC CAVEAT THAT CHANGES EVERY READ: SHIELDING IS A SPEND.
-- When a coin moves t→z its transparent UTXO is consumed exactly like a sale,
-- so it leaves these waves and never returns (it lives in the pool, invisible).
-- Therefore:
--   * these are waves of the TRANSPARENT set only, ~71% of supply;
--   * a band draining does NOT mean distribution — it may mean privacy;
--   * the pool has grown 11.6% → ~29% of supply since 2024, so the measured
--     universe is SHRINKING under the metric. Always plot alongside the
--     shielding flow (public/zcash-veil.json) or the waves will mislead.
--
-- ── COST ────────────────────────────────────────────────────────────────────
-- Zcash is far smaller than Bitcoin (~190M outputs vs billions): expect tens of
-- GB, not ~0.6 TB. Comfortably inside the 1 TB/month free tier and cheap enough
-- to iterate on — unlike the BTC query. Still DRY-RUN first (the console shows
-- "This query will process X GB" before you run).
--
-- ── HOW TO RUN ──────────────────────────────────────────────────────────────
--   1. console.cloud.google.com/bigquery (sandbox account is fine).
--   2. Paste → check the dry-run estimate → Run.
--   3. Result is small (~520 weekly rows) → SAVE RESULTS → CSV.
--   4. CHECK `total_zec` on the last row lands near 12.0M before using anything.
--
--
-- ⚠ WEEK SEMANTICS (verified offline in test/hodl-band-method.test.mjs): each
-- weekly row is the state at the END of that week (Sunday), labelled with its
-- Monday. Events are DATE_TRUNC'd to the week they fall in, so a band entry on
-- Wednesday is already counted in that Monday-labelled row. Compared against a
-- brute-force as-of computation this matches EXACTLY at Sunday and mismatches at
-- Monday. Harmless for shape, but read dates as end-of-week — and note that
-- bigquery/btc_hodl_waves.sql shares this method and therefore this semantic.
-- Verify columns in the schema browser first (free):
--   outputs: transaction_hash · index · block_timestamp · value
--   inputs:  spent_transaction_hash · spent_output_index · block_timestamp
-- ============================================================================

WITH utxo AS (
  SELECT
    o.value AS v,                              -- zatoshis (units cancel in shares)
    DATE(o.block_timestamp) AS created,
    DATE(i.block_timestamp) AS spent           -- NULL = still unspent today
  FROM `bigquery-public-data.crypto_zcash.outputs` o
  LEFT JOIN `bigquery-public-data.crypto_zcash.inputs` i
    ON  i.spent_transaction_hash = o.transaction_hash
    AND i.spent_output_index     = o.index
  WHERE o.value > 0
  -- TEST FILTER (uncomment BOTH to validate the logic on the early years cheaply):
  --   AND o.block_timestamp < TIMESTAMP '2018-01-01'
  --   AND (i.block_timestamp IS NULL OR i.block_timestamp < TIMESTAMP '2018-06-01')
),

-- Wider bands than the SPX/BTC set: Zcash is 10 years old and the question is
-- whether OLD coins moved, so the 1y+ bucket is split rather than lumped.
bounds AS (
  SELECT * FROM UNNEST([
    STRUCT(0 AS band, 0 AS lo, 30 AS hi),      -- 0–1m
    STRUCT(1, 30, 90),                         -- 1–3m
    STRUCT(2, 90, 180),                        -- 3–6m
    STRUCT(3, 180, 365),                       -- 6–12m
    STRUCT(4, 365, 730),                       -- 1–2y
    STRUCT(5, 730, 1825),                      -- 2–5y
    STRUCT(6, 1825, 40000)                     -- 5y+
  ])
),

-- +v when a UTXO enters a band, −v when it leaves (spent or aged onward).
events AS (
  SELECT b.band, DATE_ADD(u.created, INTERVAL b.lo DAY) AS d, u.v AS delta
  FROM utxo u JOIN bounds b
    ON (u.spent IS NULL OR u.spent > DATE_ADD(u.created, INTERVAL b.lo DAY))
  UNION ALL
  SELECT b.band,
         LEAST(IFNULL(u.spent, DATE '9999-01-01'), DATE_ADD(u.created, INTERVAL b.hi DAY)) AS d,
         -u.v
  FROM utxo u JOIN bounds b
    ON (u.spent IS NULL OR u.spent > DATE_ADD(u.created, INTERVAL b.lo DAY))
),

weekly AS (
  SELECT band, DATE_TRUNC(d, WEEK(MONDAY)) AS wk, SUM(delta) AS delta
  FROM events
  WHERE d <= CURRENT_DATE()
  GROUP BY band, wk
),
series AS (
  SELECT band, wk,
         SUM(delta) OVER (PARTITION BY band ORDER BY wk ROWS UNBOUNDED PRECEDING) AS zat
  FROM weekly
)

SELECT
  wk AS week,
  ROUND(100 * SUM(IF(band = 0, zat, 0)) / SUM(zat), 2) AS a0_under_1m,
  ROUND(100 * SUM(IF(band = 1, zat, 0)) / SUM(zat), 2) AS a1_1_3m,
  ROUND(100 * SUM(IF(band = 2, zat, 0)) / SUM(zat), 2) AS a2_3_6m,
  ROUND(100 * SUM(IF(band = 3, zat, 0)) / SUM(zat), 2) AS a3_6_12m,
  ROUND(100 * SUM(IF(band = 4, zat, 0)) / SUM(zat), 2) AS a4_1_2y,
  ROUND(100 * SUM(IF(band = 5, zat, 0)) / SUM(zat), 2) AS a5_2_5y,
  ROUND(100 * SUM(IF(band = 6, zat, 0)) / SUM(zat), 2) AS a6_over_5y,
  ROUND(SUM(zat) / 1e8, 0) AS total_zec        -- SANITY: latest ≈ 12.0M, not 16M
FROM series
GROUP BY wk
HAVING SUM(zat) > 0
ORDER BY wk;
