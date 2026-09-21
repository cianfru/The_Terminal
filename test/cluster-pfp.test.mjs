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

test("drainFanOut counts distinct SPX recipients, not transfers", async () => {
  const { drainFanOut } = await import("../scripts/cluster-pfp.mjs");
  const rows = [
    { dir: "OUT", cp: "0xaaa" }, { dir: "OUT", cp: "0xaaa" },  // same wallet twice = one recipient
    { dir: "OUT", cp: "0xbbb" },
    { dir: "IN",  cp: "0xccc" },                                // inbound never counts
    { dir: "OUT", cp: null },                                   // malformed rows are skipped
  ];
  assert.equal(await drainFanOut("0xme", rows), 2);
});

test("the distributor guard is tighter than the gas guard", async () => {
  const { MAX_DRAINED, MAX_FUNDED } = await import("../scripts/cluster-pfp.mjs");
  // A drain EMPTIES the sender, so migrating can only happen once per refill. Repeatedly
  // emptying into different fresh wallets is a payout pattern, and it is the stronger
  // claim of the two rules — so it gets the tighter bound.
  assert.ok(MAX_DRAINED < MAX_FUNDED);
  // Case #2559's drain source sends to 2 wallets and must survive the guard.
  assert.ok(2 <= MAX_DRAINED, "a genuine two-wallet self-move must not be dropped");
});

test("drainFanOut ignores infrastructure — a trader selling into pools is not a distributor", async () => {
  const { drainFanOut } = await import("../scripts/cluster-pfp.mjs");
  const POOL = "0x52c77b0cb827afbad022e6d6caf2c44452edbc39"; // Uniswap V2: SPX
  const rows = [
    { dir: "OUT", cp: POOL }, { dir: "OUT", cp: "0xpool2" }, { dir: "OUT", cp: "0xpool3" },
    { dir: "OUT", cp: "0xvault" },
  ];
  const skip = async a => a === POOL || a.startsWith("0xpool");
  assert.equal(await drainFanOut("0xme", rows, skip), 1, "only the plain wallet counts");
  assert.equal(await drainFanOut("0xme", rows), 4, "without the filter it looks like a distributor");
});

test("a case with no qualifying links still reports the seed, not an empty cluster", async () => {
  // Reporting zero members prints "holds 0 SPX" for a wallet that holds plenty — worse than
  // the 50,000 floor this tool replaced. Case #2451 hit exactly this.
  const { clusterPfp } = await import("../scripts/cluster-pfp.mjs");
  assert.equal(typeof clusterPfp, "function");
  const src = await import("node:fs").then(m => m.readFileSync("scripts/cluster-pfp.mjs", "utf8"));
  assert.match(src, /new Set\(\[seed,/, "the seed must be seeded into members");
});

test("a vault links: empty before, never spends, still holds what it got", async () => {
  const { isVault, withBalances } = await import("../scripts/cluster-pfp.mjs");
  // Case #2451's real vault: received 401,900 and has held exactly that ever since.
  const rows = withBalances([{ ts: "2024-11-01", dir: "IN", qty: 401900 }]);
  assert.equal(isVault(rows[0], rows), true);
});

test("a wallet that SPENDS is not a vault — that is a payment recipient", async () => {
  const { isVault, withBalances } = await import("../scripts/cluster-pfp.mjs");
  const rows = withBalances([
    { ts: "2024-11-01", dir: "IN",  qty: 401900 },
    { ts: "2024-12-01", dir: "OUT", qty: 100 },   // one spend is enough
  ]);
  assert.equal(isVault(rows[0], rows), false);
});

test("a wallet that already held something is not a fresh vault", async () => {
  const { isVault, withBalances } = await import("../scripts/cluster-pfp.mjs");
  const rows = withBalances([{ ts: "2024-10-01", dir: "IN", qty: 50 }, { ts: "2024-11-01", dir: "IN", qty: 401900 }]);
  assert.equal(isVault(rows[1], rows), false, "balBefore was not empty");
});

test("vault links are size-free — a 138-SPX vault counts", async () => {
  const { isVault, withBalances } = await import("../scripts/cluster-pfp.mjs");
  const rows = withBalances([{ ts: "2024-11-01", dir: "IN", qty: 138 }]);
  assert.equal(isVault(rows[0], rows), true);
});

test("core and gas tiers are disjoint and never merged into one number", async () => {
  const src = await import("node:fs").then(m => m.readFileSync("scripts/cluster-pfp.mjs", "utf8"));
  assert.match(src, /const gasLinked = .*\.filter\(a => !coreSet\.has\(a\)\)/s, "gas tier must exclude core");
  assert.match(src, /core = \[\.\.\.new Set\(\[seed, \.\.\.kept\.filter\(l => l\.rule !== "GAS"\)/,
    "the core is the seed plus vault/drain links only");
});

test("the service flag kills GAS links only, never vault or drain links", async () => {
  // It is derived from gas fan-out, so it says nothing about SPX flow. A vault operator
  // trips it by definition — funding ten vaults is what makes him one. Filtering all his
  // links left case #3062's eight-wallet household reporting one wallet.
  const src = await import("node:fs").then(m => m.readFileSync("scripts/cluster-pfp.mjs", "utf8"));
  assert.match(src, /l\.rule !== "GAS" \|\| \(!services\.has\(l\.from\) && !services\.has\(l\.to\)\)/,
    "vault/drain links must survive the service flag");
});

test("a consolidation links every sender, whichever one arrived first", async () => {
  const { consolidationOf, withBalances } = await import("../scripts/cluster-pfp.mjs");
  // Case #14, to the second: two wallets emptying into one empty address 72s apart.
  const rows = withBalances([
    { ts: "2024-07-08T23:03:35", dir: "IN", qty: 1630000, cp: "0x98e97737", tx: "0xa" },
    { ts: "2024-07-08T23:04:47", dir: "IN", qty: 2000000, cp: "0xce9a1739", tx: "0xb" },
  ]);
  const drained = () => true;
  // the SECOND transfer is the one the 1-to-1 rule rejected, because by then the target
  // held 1.63M. It must link here — the order of two transactions a minute apart cannot
  // decide whether two wallets belong to one person.
  assert.deepEqual(consolidationOf("0xb", rows, drained).senders.sort(), ["0x98e97737", "0xce9a1739"]);
  assert.deepEqual(consolidationOf("0xa", rows, drained).senders.sort(), ["0x98e97737", "0xce9a1739"]);
});

test("one sender alone is not a consolidation", async () => {
  const { consolidationOf, withBalances } = await import("../scripts/cluster-pfp.mjs");
  const rows = withBalances([{ ts: "2024-07-08T23:03:35", dir: "IN", qty: 5, cp: "0xa", tx: "0x1" }]);
  assert.equal(consolidationOf("0x1", rows, () => true), null);
});

test("a sender that did NOT empty itself is excluded", async () => {
  const { consolidationOf, withBalances } = await import("../scripts/cluster-pfp.mjs");
  const rows = withBalances([
    { ts: "2024-07-08T23:03:35", dir: "IN", qty: 100, cp: "0xa", tx: "0x1" },
    { ts: "2024-07-08T23:04:47", dir: "IN", qty: 100, cp: "0xb", tx: "0x2" },
  ]);
  // only 0xa emptied; 0xb made an ordinary payment, so there is no group of two
  assert.equal(consolidationOf("0x1", rows, (s) => s === "0xa"), null);
});

test("arrivals outside the window are not one event", async () => {
  const { consolidationOf, withBalances } = await import("../scripts/cluster-pfp.mjs");
  const rows = withBalances([
    { ts: "2024-07-08T23:03:35", dir: "IN", qty: 100, cp: "0xa", tx: "0x1" },
    { ts: "2024-09-01T10:00:00", dir: "IN", qty: 100, cp: "0xb", tx: "0x2" },
  ]);
  assert.equal(consolidationOf("0x1", rows, () => true), null, "two months apart is not a gather");
});

test("the target must have been empty before the group started", async () => {
  const { consolidationOf, withBalances } = await import("../scripts/cluster-pfp.mjs");
  const rows = withBalances([
    { ts: "2024-01-01T00:00:00", dir: "IN", qty: 500, cp: "0xz", tx: "0x0" },   // pre-existing balance
    { ts: "2024-07-08T23:03:35", dir: "IN", qty: 100, cp: "0xa", tx: "0x1" },
    { ts: "2024-07-08T23:04:47", dir: "IN", qty: 100, cp: "0xb", tx: "0x2" },
  ]);
  // the only empty-target anchor is 0x0, six months earlier, so the July pair is outside it
  assert.equal(consolidationOf("0x2", rows, () => true), null);
});

test("a transfer that satisfies two rules is emitted once", async () => {
  // Case #14's 1,630,000 arrived first, so it BOTH drained into an empty wallet and
  // anchored the consolidation. Keying the dedupe on the rule emitted it twice.
  const src = await import("node:fs").then(m => m.readFileSync("scripts/cluster-pfp.mjs", "utf8"));
  assert.match(src, /\$\{l\.tx\}\|\$\{l\.from\}\|\$\{l\.to\}/, "dedupe must key on the transfer, not the rule");
  assert.match(src, /RANK = \{ CONSOLIDATION: 0/, "and prefer the rule that explains the most");
});
