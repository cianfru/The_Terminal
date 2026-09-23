// The AEON landscape study: the pure pieces, and the bugs that each cost a gate.
import test from "node:test";
import assert from "node:assert/strict";
import { withBal, capHubs, components, households } from "../research/pfp-forensics/landscape/households.mjs";
import { parseTime, venueKind } from "../research/pfp-forensics/landscape/ledger.mjs";

test("archive timestamps parse in both formats it uses", () => {
  assert.equal(parseTime("2023-08-16 02:42:47 UTC"), Date.parse("2023-08-16T02:42:47Z"));
  assert.equal(parseTime("2026-08-26 05:46:47.000 UTC"), Date.parse("2026-08-26T05:46:47Z"));
});

test("within one block, receives apply before sends — or a forwarder reads as overdrawn", () => {
  const r = withBal([{ t: 5, dir: "OUT", qty: 100, cp: "b" }, { t: 5, dir: "IN", qty: 100, cp: "a" }]);
  assert.deepEqual(r.map(x => [x.dir, x.before]), [["IN", 0], ["OUT", 100]]);
});

test("venue verdict: pools and routers trade, the zero address mints, anything else is a transfer", () => {
  assert.equal(venueKind("IN", "0x52c77b0cb827afbad022e6d6caf2c44452edbc39"), "buy");
  assert.equal(venueKind("OUT", "0x0000000000000000000000000000000000000000"), "burn");
  assert.equal(venueKind("OUT", "0xabc"), "out");
});

test("a hub above the cap is a service: its links are dropped and it is flagged", () => {
  const links = Array.from({ length: 9 }, (_, i) => ({ rule: "VAULT", from: "hub", to: "v" + i, t: i }))
    .concat([{ rule: "VAULT", from: "saver", to: "v99", t: 99 }]);
  const { kept, flagged } = capHubs(links, 8);
  assert.equal(kept.length, 1, "the 9-vault sender's links go; the 1-vault saver's stays");
  assert.deepEqual(flagged.map(f => [f.address, f.links]), [["hub", 9]]);
});

test("components merge across seeds and keep lone seeds", () => {
  const g = components(["a", "d"], [{ from: "a", to: "b" }, { from: "b", to: "c" }]);
  assert.equal(g.find(x => x.includes("a")).length, 3);
  assert.deepEqual(g.find(x => x.includes("d")), ["d"]);
});

// ⚠ The bug that dropped #14's origin wallet on the full sweep. Another seed reaches M at the
// depth limit and it was marked visited WITHOUT being expanded, so seed S — one hop from M —
// skipped it and never read M's link onward to O.
test("a wallet first reached at the depth limit is still expanded when a later seed reaches it shallower", async () => {
  const Z = "0x0000000000000000000000000000000000000000";
  const led = {
    x: [{ t: 0, dir: "IN", cp: Z, qty: 100 }, { t: 1, dir: "OUT", cp: "a", qty: 100 }],
    a: [{ t: 1, dir: "IN", cp: "x", qty: 100 }, { t: 2, dir: "OUT", cp: "b", qty: 100 }],
    b: [{ t: 2, dir: "IN", cp: "a", qty: 100 }, { t: 3, dir: "OUT", cp: "m", qty: 100 }],
    m: [{ t: 3, dir: "IN", cp: "b", qty: 100 }, { t: 4, dir: "OUT", cp: "o", qty: 100 }, { t: 5, dir: "IN", cp: "s", qty: 50 }],
    o: [{ t: 4, dir: "IN", cp: "m", qty: 100 }],
    s: [{ t: 0, dir: "IN", cp: Z, qty: 50 }, { t: 5, dir: "OUT", cp: "m", qty: 50 }],
  };
  const L = { ledger: a => led[a] || [] };
  const isInfra = async a => a === Z;
  const { groups } = await households(L, ["x", "s"], isInfra, { maxDepth: 3 });
  const gs = groups.find(g => g.includes("s"));
  assert.ok(gs.includes("o"), "o is two hops from seed s through m, well inside the depth limit");
});

// ⚠ The collection sweep read V2 liquidity as "rotation" and a 1,000,000-SPX sale for sUSDe as
// a swap into another token. Both would have been wrong in the direction of "not selling".
test("a V2 liquidity deposit is not a rotation, and a withdrawal is not a buy", async () => {
  const { upgradeKind, isLpToken } = await import("../scripts/bot/kol-cluster.mjs");
  assert.equal(isLpToken("0x52c77b0cb827afbad022e6d6caf2c44452edbc39"), true, "the SPX/WETH pair is its own LP token");
  assert.equal(isLpToken("0xeb01e59e18136859e21a7179e982bc4247df8a33", "UNI-V2"), true);
  assert.equal(isLpToken("0xaaee1a9723aadb7afa2810263653a34ba2c21c7a", "MOG"), false);
  assert.equal(upgradeKind("sell", { lpTokenIn: 1 }), "lpOut");
  assert.equal(upgradeKind("buy", { lpTokenOut: 1, valueIn: 2 }), "lpIn");
  assert.equal(upgradeKind("sell", { otherIn: 1 }), "rotation", "a genuine swap into MOG is still a rotation");
});

test("selling SPX for a major stablecoin, staked ETH or BTC is a sale, not a rotation", async () => {
  const { VALUE_TOKENS } = await import("../scripts/bot/kol-cluster.mjs");
  for (const [sym, a] of [["sUSDe", "0x9d39a5de30e57443bff2a8307a4256c8797a3497"], ["stETH", "0xae7ab96520de3a18e5e111b5eaab095312d7fe84"],
                          ["WBTC", "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"], ["PYUSD", "0x6c3ea9036406852006290770bedfcaba0e23a0e8"]])
    assert.ok(VALUE_TOKENS.has(a), `${sym} must count as money`);
  assert.ok(!VALUE_TOKENS.has("0xfd03723a9a3abe0562451496a9a394d2c4bad4ab"), "niche stables (DYAD) stay out — conservative");
});

// Regression: a wallet with more SPX transfers than the page cap came back truncated with no error
// (1,893 of 5,489) and its household read −537,445 SPX. tradeHistory must throw, never guess.
test("tradeHistory refuses a ledger that runs past the page cap", async () => {
  const { tradeHistory, LEDGER_MAX_PAGES } = await import("../scripts/bot/kol-cluster.mjs");
  let calls = 0;
  const endless = async () => ({ ok: true, status: 200, json: async () => {
    calls++;
    return { items: [{ timestamp: "2024-01-01T00:00:00Z", transaction_hash: "0x" + calls.toString(16).padStart(64, "0"),
      from: { hash: "0x" + "1".repeat(40) }, to: { hash: "0x" + "2".repeat(40) }, total: { value: "100000000" } }],
      next_page_params: { block_number: calls } };
  } });
  await assert.rejects(() => tradeHistory(["0x" + "2".repeat(40)], { fetchImpl: endless }), /truncated/);
  assert.equal(calls, LEDGER_MAX_PAGES);
});

test("report verdicts are exhaustive and measured by quantity", async () => {
  const { verdict, aggregate } = await import("../research/pfp-forensics/landscape/report.mjs");
  const base = { reconciles: true, wallets: ["0xa"], buys: { qty: 0 }, sells: { qty: 0 }, rotation: { qty: 0 }, received: 0, movedOut: 0 };
  assert.equal(verdict({ ...base, buys: { qty: 100 }, holds: 100 }).verdict, "never-sold");
  assert.equal(verdict({ ...base, buys: { qty: 100 }, sells: { qty: 40 }, holds: 60 }).verdict, "holding");
  assert.equal(verdict({ ...base, buys: { qty: 100 }, rotation: { qty: 80 }, holds: 20 }).verdict, "trimming");
  assert.equal(verdict({ ...base, buys: { qty: 100 }, sells: { qty: 100 }, holds: 0.2 }).verdict, "exited");
  // one big seller outweighs many small buyers — quantity, not count
  const rows = [
    ...Array.from({ length: 40 }, (_, i) => ({ ...base, key: "b" + i, buys: { qty: 10 }, holds: 10 })),
    { ...base, key: "s", buys: { qty: 1000 }, sells: { qty: 2000 }, received: 1000, holds: 0 },
    { key: "x", wallets: ["0xb"], failed: "blockscout unreachable" },
  ];
  const a = aggregate(rows);
  assert.equal(a.totals.households, 41);
  assert.equal(a.excluded.length, 1);
  assert.equal(a.totals.bought, 1400);
  assert.equal(a.totals.soldAll, 2000);
  assert.equal(a.sellersFor80pct, 1);
});

test("AEON Ledger public layer drops every address and rounds only per-owner figures", async () => {
  const { sig3, buildLedger, publicLedger } = await import("../research/pfp-forensics/landscape/export.mjs");
  assert.equal(sig3(14157552), 14200000);
  assert.equal(sig3(975), 975);
  assert.equal(sig3(1234.6), 1230);
  assert.equal(sig3(0), 0);
  const w = i => "0x" + String(i).padStart(40, "0");
  const base = { reconciles: true, sells: { qty: 0, usd: 0 }, rotation: { qty: 0, usd: 0 }, received: 0, movedOut: 0, byYear: {} };
  const rows = [
    { ...base, key: w(1), wallets: [w(1), w(2)], aeon: 3, buys: { qty: 1234567, usd: 999 }, holds: 1234567, firstBuy: "2023-08-20T00:00:00Z" },
    { ...base, key: w(3), wallets: [w(3)], aeon: 1, buys: { qty: 500, usd: 10 }, sells: { qty: 500, usd: 20 }, holds: 0 },
  ];
  const full = buildLedger(rows, { asOf: "2026-09-23T00:00:00Z", households: [
    { aeonHolders: [w(1)], spxEver: true }, { aeonHolders: [w(3)], spxEver: true }, { aeonHolders: [w(9)], spxEver: false }] });
  assert.equal(full.owners[0].n, 1);
  assert.deepEqual(full.owners[0].wallets, [w(1), w(2)]);
  assert.equal(full.scope.neverTouchedSpx, 1);
  const pub = publicLedger(full);
  assert.ok(!/0x[0-9a-f]{40}/i.test(JSON.stringify(pub)), "no address in the public layer");
  assert.equal(pub.owners[0].holds, 1230000);
  assert.equal(pub.totals.bought, 1235067, "totals stay exact");
  assert.equal(pub.owners[0].firstBuy, "2023-08");
});

test("a refresh re-reads address ledgers and caches only immutable transaction pages", async () => {
  const { IMMUTABLE_ONLY } = await import("../research/pfp-forensics/landscape/cached-fetch.mjs");
  assert.ok(IMMUTABLE_ONLY("https://eth.blockscout.com/api/v2/transactions/0x" + "a".repeat(64)));
  assert.ok(IMMUTABLE_ONLY("https://eth.blockscout.com/api/v2/transactions/0x" + "a".repeat(64) + "/token-transfers"));
  assert.ok(!IMMUTABLE_ONLY("https://eth.blockscout.com/api/v2/addresses/0x" + "a".repeat(40) + "/token-transfers?token=0xe0f6"));
});
