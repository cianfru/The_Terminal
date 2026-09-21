// The pure core of the PFP clustering rules. Network paths are not tested here; these are the
// decisions that, if wrong, produce a confident and wrong cluster.
import test from "node:test";
import assert from "node:assert/strict";
import { withBalances, isDrainIntoEmpty, codeIsContract, isDelegatedEoa, loadTags, MAX_FUNDED } from "../scripts/cluster-pfp.mjs";

test("withBalances records the balance BEFORE each transfer, in time order", () => {
  const b = withBalances([
    { ts: "2024-01-03", dir: "OUT", qty: 40 },
    { ts: "2024-01-01", dir: "IN",  qty: 1000 },
    { ts: "2024-01-02", dir: "OUT", qty: 960 },
  ]);
  assert.deepEqual(b.map(r => r.balBefore), [0, 1000, 40]);
  assert.equal(b.at(-1).balAfter, 0);
});

test("a drain into an empty wallet links, at ANY size — small is the finding here", () => {
  // 138 SPX is what case #3062's trader wallet actually holds. A 50,000-token floor is blind to it.
  const b = withBalances([{ ts: "2024-01-01", dir: "IN", qty: 138 }, { ts: "2024-01-02", dir: "OUT", qty: 138 }]);
  assert.equal(isDrainIntoEmpty(b[1], { balBefore: 0 }), true);
});

test("a drain into a LIVE wallet does not link — that is a payment, not a self-move", () => {
  const b = withBalances([{ ts: "2024-01-01", dir: "IN", qty: 1000 }, { ts: "2024-01-02", dir: "OUT", qty: 1000 }]);
  assert.equal(isDrainIntoEmpty(b[1], { balBefore: 500 }), false);
});

test("a partial send out of a funded wallet does not link even if the recipient is empty", () => {
  const b = withBalances([{ ts: "2024-01-01", dir: "IN", qty: 1000 }, { ts: "2024-01-02", dir: "OUT", qty: 100 }]);
  assert.equal(isDrainIntoEmpty(b[1], { balBefore: 0 }), false);
});

test("a send from a wallet that never held anything cannot be a drain", () => {
  assert.equal(isDrainIntoEmpty({ balBefore: 0, qty: 500 }, { balBefore: 0 }), false);
});

test("missing either side is not a link", () => {
  assert.equal(isDrainIntoEmpty(null, { balBefore: 0 }), false);
  assert.equal(isDrainIntoEmpty({ balBefore: 100, qty: 100 }, null), false);
});

test("an EIP-7702 delegated EOA is NOT a contract", () => {
  // 0xc41e7f22 on mainnet. Pectra shipped May 2025, so this code says nothing about its 2023-24
  // history; calling it a contract retroactively drops every link through it.
  const code = "0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b";
  assert.equal(isDelegatedEoa(code), true);
  assert.equal(codeIsContract(code), false);
  assert.equal(codeIsContract("0xEF0100aabb"), false, "prefix check must be case-insensitive");
});

test("real bytecode is a contract, and an empty account is not", () => {
  assert.equal(codeIsContract("0x60806040523480156100"), true);
  assert.equal(codeIsContract("0x"), false);
  assert.equal(codeIsContract(null), false);
});

test("tags are read from the FIFO engine so the two cannot drift", () => {
  const tags = loadTags(`EXCLUDE_LABELS = {
    "0x52c77b0cb827afbad022e6d6caf2c44452edbc39": { name: "Uniswap V2: SPX", kind: "lp" },
    "0x7dafba1d69f6c01ae7567ffd7b046ca03b706f83": { name: "Kraken 245", kind: "cex" },
  }`);
  assert.equal(tags["0x52c77b0cb827afbad022e6d6caf2c44452edbc39"].kind, "lp");
  assert.equal(tags["0x7dafba1d69f6c01ae7567ffd7b046ca03b706f83"].name, "Kraken 245");
});

test("the live engine's real tag list loads and covers the SPX pools", () => {
  const tags = loadTags();
  assert.ok(Object.keys(tags).length > 50, "expected the full infrastructure list");
  assert.equal(tags["0x52c77b0cb827afbad022e6d6caf2c44452edbc39"]?.kind, "lp");
});

test("the gas-funder guard is tight enough to reject a service", () => {
  // One funder on case #14 fed 42 distinct wallets. Whatever the number, it must reject that.
  assert.ok(MAX_FUNDED < 42);
});
