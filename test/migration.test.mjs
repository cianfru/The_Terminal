import { test } from "node:test";
import assert from "node:assert/strict";
import { replayFifo, makePriceAt, detectMigrations } from "../scripts/build-onchain-local.mjs";
import { driverFor, scanAnomalies } from "../scripts/bot/anomaly-scan.mjs";

const DAY = 86400000, MIN = 60000;
const D0 = Date.UTC(2025, 6, 17);
const d = n => D0 + n * DAY;
const ZERO = "0x0000000000000000000000000000000000000000";    // excluded (mint)
const BYBIT = "0x651641299c7ec0aa44ad7ed9b7e12702fed2022f";   // excluded (a tagged exchange)
const near = (a, b, e = 0.01) => assert.ok(Math.abs(a - b) <= e, `${a} ≈ ${b}`);

// The 2026-09-26 shape: an old holder tests a brand-new wallet (12 over, 5 back), then sends 10,000, then
// the rest. Bought at $1.76 from an exchange 435 days earlier; price now $0.455.
const migration = (T, from = "old", to = "new", bal = 1_781_298) => [
  { from, to, ts: T, amt: 12 },
  { from: to, to: from, ts: T + 30 * MIN, amt: 5 },
  { from, to, ts: T + 48 * MIN, amt: 10_000 },
  { from, to, ts: T + 53 * MIN, amt: bal - 12 + 5 - 10_000 },
];
const price = makePriceAt([[d(0), 1.76], [d(435), 0.455]]);
const bought = [{ from: BYBIT, to: "old", ts: d(0), amt: 1_781_298 }];

test("a tested wallet migration is detected — every leg, one event", () => {
  const { migIdx, events } = detectMigrations([...bought, ...migration(d(435))]);
  assert.equal(events.length, 1);
  assert.equal(events[0].source, "old");
  assert.equal(events[0].target, "new");
  assert.equal(migIdx.size, 4, "the two tests, the return leg and the final send are all moves");
});

test("a migration keeps the coins' age and cost: no realized loss, no coin-days destroyed", () => {
  const [r] = replayFifo([...bought, ...migration(d(435))], price, [d(436)]);
  near(r.nrplLoss, 0, 1);
  near(r.cdd, 0, 1);
  assert.equal(r.holders, 1);
  near(r.age[4], 100);                                   // still over a year old, not reset to fresh
  near(r.rp, 1.76, 0.001);                               // cost basis carried over, not re-priced at $0.455
});

test("without the rule the same move reads as a $2.3M loss (what the radar saw)", () => {
  const [r] = replayFifo([...bought, ...migration(d(435))], price, [d(436)], { detectSplits: false });
  assert.ok(r.nrplLoss > 2.3e6, `loss ${r.nrplLoss}`);
  assert.ok(r.cdd > 7.6e8, `cdd ${r.cdd}`);
});

test("no return leg → not a migration (an exchange deposit address never sends back)", () => {
  const tx = [...bought, { from: "old", to: "dep", ts: d(435), amt: 12 }, { from: "old", to: "dep", ts: d(435) + 5 * MIN, amt: 1_781_286 }];
  assert.equal(detectMigrations(tx).events.length, 0);
});

test("the new wallet dealing with anyone else voids it", () => {
  const tx = [...bought, ...migration(d(435))];
  tx.splice(3, 0, { from: "stranger", to: "new", ts: d(435) + 40 * MIN, amt: 1 });
  tx.unshift({ from: ZERO, to: "stranger", ts: d(1), amt: 10 });
  assert.equal(detectMigrations(tx).events.length, 0);
});

test("a recipient that already held SPX is not a new wallet", () => {
  const tx = [{ from: ZERO, to: "new", ts: d(1), amt: 500 }, ...bought, ...migration(d(435))];
  assert.equal(detectMigrations(tx).events.length, 0);
});

test("a handshake older than 24 hours doesn't count", () => {
  const T = d(435);
  const tx = [...bought, { from: "old", to: "new", ts: T, amt: 12 }, { from: "new", to: "old", ts: T + MIN, amt: 5 },
    { from: "old", to: "new", ts: T + 2 * DAY, amt: 1_781_291 }];
  assert.equal(detectMigrations(tx).events.length, 0);
});

test("a partial send after a handshake is still a spend (≥90% of the balance required)", () => {
  const T = d(435);
  const tx = [...bought, { from: "old", to: "new", ts: T, amt: 12 }, { from: "new", to: "old", ts: T + MIN, amt: 5 },
    { from: "old", to: "new", ts: T + 2 * MIN, amt: 500_000 }];
  assert.equal(detectMigrations(tx).events.length, 0);
});

test("the engine records who drove the day's spend numbers", () => {
  const tx = [...bought, { from: ZERO, to: "small", ts: d(0), amt: 1000 },
    { from: "old", to: BYBIT, ts: d(435), amt: 1_000_000 },          // a real sale onto an exchange
    { from: "small", to: BYBIT, ts: d(435), amt: 1000 }];
  const [r] = replayFifo(tx, price, [d(436)]);
  assert.equal(r.drivers.senders, 2);
  assert.equal(r.drivers.loss[0].a, "old");
  assert.equal(r.drivers.loss[0].to, BYBIT);
  assert.ok(r.drivers.loss[0].v / r.nrplLoss > 0.99);
  assert.equal(r.drivers.cdd[0].a, "old");
});

test("drivers ride only the most recent rows", () => {
  const rows = replayFifo(bought, price, Array.from({ length: 20 }, (_, i) => d(i + 1)), { driverRows: 5 });
  assert.equal(rows.filter(r => r.drivers).length, 5);
  assert.ok(!rows[0].drivers && rows.at(-1).drivers);
});

test("the radar names the biggest contributor and its share", () => {
  const calm = Array.from({ length: 40 }, (_, i) => ({ d: `d${i}`, cdd: 1e8 + (i % 3) * 1e6, nrplLoss: 8e4 + (i % 3) * 1e3 }));
  const spike = { d: "d40", cdd: 1e9, nrplLoss: 2.75e6, drivers: { senders: 900, cdd: [{ a: "old", to: "new", q: 1.77e6, v: 7.7e8 }], loss: [{ a: "old", to: "new", q: 1.77e6, v: 2.31e6 }], profit: [] } };
  const r = scanAnomalies({ onchain: [...calm, spike] });
  const loss = r.items.find(x => x.key === "nrplLoss"), cdd = r.items.find(x => x.key === "cdd");
  assert.equal(loss.driver.a, "old");
  near(loss.driver.share, 0.84, 0.01);
  near(cdd.driver.share, 0.77, 0.01);
});

test("exchange-balance flags name the venue that moved most", () => {
  const onchain = [{ cexVenues: { Kraken: 100, Bybit: 50 } }, { cexVenues: { Kraken: 95, Bybit: 70 } }];
  assert.deepEqual(driverFor({ key: "cexBal", dir: "up" }, onchain), { kind: "venue", venue: "Bybit", delta: 20 });
});
