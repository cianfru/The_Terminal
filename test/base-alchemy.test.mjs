import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTransfers, rawToStr, strToRaw, decodeTransfer, loadCohort, dumpCohort, loadAll, dumpAll, mergeAll, countHolders } from "../scripts/build-base-alchemy.mjs";

const ZERO = "0x0000000000000000000000000000000000000000";
const raw = n => BigInt(n) * 100000000n;
const mint = (to, n, day, block = 1) => ({ from: ZERO, to, value: raw(n), day, block });
const send = (from, to, n, day, block = 1) => ({ from, to, value: raw(n), day, block });

test("rawToStr/strToRaw round-trip (sign-aware, 8dp)", () => {
  for (const v of [0n, raw(5000), 922533950624220n, -1206904862620n]) assert.equal(strToRaw(rawToStr(v)), v);
  assert.equal(rawToStr(raw(6000)), "6000.00000000");
});

test("applyTransfers: crossing up sets first/since/holder; down sets exit; re-cross keeps first", () => {
  const c = new Map();
  applyTransfers(c, [
    mint("0xa", 6000, "2024-01-01"),   // A → 6k: holder, first=since=Jan1
    send("0xa", "0xb", 4000, "2024-02-01"), // A → 2k (exit Feb1); B → 4k (still <5k)
    mint("0xb", 2000, "2024-03-01"),   // B → 6k: first=since=Mar1
    mint("0xa", 4000, "2024-06-01"),   // A → 6k again: re-cross, first stays Jan1, since=Jun1
  ]);
  const a = c.get("0xa"), b = c.get("0xb");
  assert.equal(a.status, "holder"); assert.equal(a.first, "2024-01-01"); assert.equal(a.since, "2024-06-01"); assert.equal(a.exit, "");
  assert.equal(a.bal, raw(6000));
  assert.equal(b.status, "holder"); assert.equal(b.first, "2024-03-01");
});

test("applyTransfers: an exited wallet keeps its first day and exit day", () => {
  const c = new Map();
  applyTransfers(c, [mint("0xc", 8000, "2024-05-01"), send("0xc", "0xd", 5000, "2025-06-18")]);
  const cc = c.get("0xc");
  assert.equal(cc.status, "exited"); assert.equal(cc.first, "2024-05-01"); assert.equal(cc.exit, "2025-06-18");
});

test("decodeTransfer: Alchemy shape → {from,to,value,day,block}", () => {
  const d = decodeTransfer({ from: "0xAA", to: "0xBB", rawContract: { value: "0x" + raw(1413).toString(16) }, metadata: { blockTimestamp: "2024-07-26T06:53:52.000Z" }, blockNum: "0x8639f7" });
  assert.equal(d.from, "0xaa"); assert.equal(d.value, raw(1413)); assert.equal(d.day, "2024-07-26"); assert.equal(d.block, 8796663);
  assert.equal(decodeTransfer({ from: "0xAA", to: "0xBB", rawContract: { value: "0x1" }, metadata: {}, blockNum: "0x1" }), null); // no timestamp
});

test("loadCohort/dumpCohort: round-trips with the lastBlock header", () => {
  const c = new Map(); applyTransfers(c, [mint("0xa", 6000, "2024-01-01"), mint("0xb", 9000, "2024-02-01")]);
  const csv = dumpCohort(c, 12345678);
  assert.match(csv, /^# lastBlock=12345678/);
  const { cohort, lastBlock } = loadCohort(csv);
  assert.equal(lastBlock, 12345678);
  assert.equal(cohort.get("0xb").bal, raw(9000));
  assert.equal(cohort.get("0xa").first, "2024-01-01");
});

test("every-wallet balances round-trip, carry sub-5k wallets forward, and count holders minus contracts", async () => {
  const U = 100000000n, day = "2026-10-20";
  const cohort = applyTransfers(new Map(), [
    { from: "0x0000000000000000000000000000000000000000", to: "0xpool", value: 1000000n * U, day },
    { from: "0xpool", to: "0xwhale", value: 9000n * U, day },
    { from: "0xpool", to: "0xsmall", value: 300n * U, day },
    { from: "0xpool", to: "0xgone", value: 50n * U, day },
    { from: "0xgone", to: "0xsmall", value: 50n * U, day },
  ]);
  const text = dumpAll(cohort, 123);
  assert.ok(!text.includes("0xgone"));                       // zero balance → not stored
  const { bal, lastBlock } = loadAll(text);
  assert.equal(lastBlock, 123);
  assert.equal(bal.get("0xsmall"), 350n * U);

  // next day: the cohort CSV only knows the ≥5k wallets; merging restores the small one
  const { cohort: c2 } = loadCohort(dumpCohort(cohort, 123));
  assert.ok(!c2.has("0xsmall"));
  mergeAll(c2, bal);
  applyTransfers(c2, [{ from: "0xsmall", to: "0xnew", value: 100n * U, day: "2026-10-21" }]);
  assert.equal(c2.get("0xsmall").bal, 250n * U);
  assert.equal(c2.get("0xwhale").status, "holder");          // cohort row kept its ≥5k state

  const r = await countHolders(c2, async a => a === "0xpool");
  assert.deepEqual(r, { holders: 3, nonzero: 4, contracts: 1 });   // whale, small, new (pool removed)
});
