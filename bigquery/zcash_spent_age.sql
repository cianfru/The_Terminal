-- ============================================================================
-- ZCASH — AGE OF COINS SPENT, PER WEEK ("who moved, and how old were they")
-- ============================================================================
-- The companion to zcash_hodl_waves.sql, and the one that actually answers
-- "what happened before the September-2025 runup".
--
-- HODL waves show the age structure of coins SITTING STILL. This shows the age
-- structure of coins that MOVED — for every week, how much value was spent and
-- how old it was when it moved, plus the coin-days destroyed. A dormant whale
-- waking up is invisible in a waves chart until after the fact; here it is a bar.
--
-- WHAT WE ALREADY KNOW FROM THE CHEAP (Blockchair) VERSION, which this query is
-- meant to confirm or kill:
--   * Aug-2025 (month BEFORE the move): coin-days destroyed ran 3.8x baseline
--     while price sat flat at $41, and +535,968 ZEC net went INTO the pool.
--   * Sep-2025 +82%, Oct-2025 +447% with CDD at 21.2x baseline.
--   * BUT the same dormancy signal fired in Mar-2025 (5.2x) and Apr-2025 (4.3x)
--     and price FELL after both. One hit, two misses. This query exists to say
--     whether the Aug-2025 spike was OLD coins specifically, which the aggregate
--     CDD number cannot distinguish.
--
-- ⚠⚠ THE CAVEAT THAT CANNOT BE DROPPED: on Zcash, SHIELDING IS A SPEND. A coin
-- moving t→z is consumed identically to a coin being sold. So `spent_over_1y`
-- rising means "old coins moved", NEVER "old coins were sold". Cross every spike
-- against the net shielding flow in public/zcash-veil.json:
--   spike + heavy net shielding  -> old money went PRIVATE (cannot be followed)
--   spike + net deshielding      -> more consistent with distribution
-- Publishing a spike as "whales sold" is asserting something this data does not
-- contain, on a chain engineered so that nobody can know.
--
-- ── COST ── Same two tables as the waves query, one join, no fan-out to bands:
-- cheaper. Tens of GB. DRY-RUN first. Result ~520 rows → SAVE RESULTS → CSV.
--
-- SANITY: `spent_zec` summed across all weeks must be far LESS than total
-- outputs ever created (most coins are spent, but never-spent supply remains).
-- If any week's spent_zec exceeds transparent supply (~12.0M), the join fanned
-- out — stop and check for duplicate (spent_transaction_hash, spent_output_index).
-- ============================================================================

WITH spends AS (
  SELECT
    o.value                                        AS v,
    DATE(o.block_timestamp)                        AS created,
    DATE(i.block_timestamp)                        AS spent,
    DATE_DIFF(DATE(i.block_timestamp), DATE(o.block_timestamp), DAY) AS age_days
  FROM `bigquery-public-data.crypto_zcash.outputs` o
  JOIN `bigquery-public-data.crypto_zcash.inputs` i        -- INNER: spent coins only
    ON  i.spent_transaction_hash = o.transaction_hash
    AND i.spent_output_index     = o.index
  WHERE o.value > 0
  -- TEST FILTER (uncomment to validate cheaply before the real run):
  --   AND i.block_timestamp >= TIMESTAMP '2025-06-01'
  --   AND i.block_timestamp <  TIMESTAMP '2025-12-01'
)

SELECT
  DATE_TRUNC(spent, WEEK(MONDAY))                          AS week,
  ROUND(SUM(v) / 1e8, 2)                                   AS spent_zec,
  -- how old the moving coins were, as shares of that week's spent value
  ROUND(100 * SUM(IF(age_days <  30, v, 0)) / SUM(v), 2)   AS s0_under_1m,
  ROUND(100 * SUM(IF(age_days >=  30 AND age_days < 180, v, 0)) / SUM(v), 2) AS s1_1_6m,
  ROUND(100 * SUM(IF(age_days >= 180 AND age_days < 365, v, 0)) / SUM(v), 2) AS s2_6_12m,
  ROUND(100 * SUM(IF(age_days >= 365 AND age_days < 730, v, 0)) / SUM(v), 2) AS s3_1_2y,
  ROUND(100 * SUM(IF(age_days >= 730, v, 0)) / SUM(v), 2)  AS s4_over_2y,
  -- absolute old-coin movement: the number a dormancy spike is actually made of
  ROUND(SUM(IF(age_days >= 365, v, 0)) / 1e8, 2)           AS spent_over_1y_zec,
  -- coin-days destroyed, so this reconciles against the Blockchair CDD series
  ROUND(SUM(v * age_days) / 1e8, 0)                        AS coin_days_destroyed,
  -- average age of a moving coin — the single cleanest "did old money wake up" line
  ROUND(SUM(v * age_days) / SUM(v), 1)                     AS avg_age_days
FROM spends
WHERE spent IS NOT NULL
GROUP BY week
ORDER BY week;
