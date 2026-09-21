// The pure core of the KOL cluster watcher. Network paths are not tested here; these are
// the decisions that, if wrong, post a false claim about a named wallet.
import test from "node:test";
import assert from "node:assert/strict";
import { classify, clusterOf, POOLS, ROUTERS } from "../scripts/bot/kol-cluster.mjs";
import { pickSale, alreadyPosted, recordPosted, copyFor } from "../scripts/bot/kol-watch.mjs";
import { logTicks } from "../scripts/bot/kol-sale-card.mjs";
import { withFooter } from "../scripts/bot/posts.mjs";
import { xLen } from "../scripts/bot/llm-copy.mjs";

const COW = "0x9008d19f58aabd9ed0d60971565aa8510560ab41";
const V2 = "0x52c77b0cb827afbad022e6d6caf2c44452edbc39";
const NPM = "0xc36442b4a4522e871399cd717abdd847ab11fe88";

test("a CoW sell is a sell even though tx.to is an unknown solver contract", () => {
  // Real case: 35,000 SPX left the wallet, tx.to was 0x8F5835e9 (an unverified solver),
  // and the tokens went to GPv2Settlement. Keying on tx.to alone lost four real sells
  // worth 59,260 SPX on the first tracked cluster.
  assert.equal(classify({ dir: "OUT", cp: COW, txTo: "0x8f5835e9d756c9bd934bce527157a4b0ef3c5cb7" }), "sell");
});

test("a direct pool swap classifies from either side", () => {
  assert.equal(classify({ dir: "OUT", cp: V2, txTo: V2 }), "sell");
  assert.equal(classify({ dir: "IN", cp: V2, txTo: V2 }), "buy");
});

test("an LP mint is NOT a sale — those tokens come back", () => {
  assert.equal(classify({ dir: "OUT", cp: NPM, txTo: NPM, txMethod: "mint" }), "lpOut");
  assert.equal(classify({ dir: "IN", cp: NPM, txTo: NPM, txMethod: "multicall" }), "lpIn");
});

test("a plain wallet-to-wallet transfer is not a trade", () => {
  assert.equal(classify({ dir: "OUT", cp: "0xfriend", txTo: "0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c", txMethod: "transfer" }), "out");
});

test("supplying SPX as collateral is not a sell", () => {
  // The #2451 trader put 100,000 SPX into Morpho as collateral. Economically close to
  // selling, but he did not sell it, and the bot must not say he did.
  assert.equal(classify({ dir: "OUT", cp: "0xmorpho", txTo: "0xmorpho", txMethod: "supplyCollateral" }), "out");
});

test("the venue sets cover the pools and routers the cluster actually used", () => {
  assert.ok(POOLS.has(V2));
  assert.ok(ROUTERS.has(COW));
  assert.ok(ROUTERS.has("0xdef1c0ded9bec7f1a1670819833240f027b25eff"), "0x Exchange Proxy");
});

test("pickSale takes the newest fresh sell and never a buy", () => {
  const now = Date.parse("2026-09-21T00:00:00Z");
  const rows = [
    { kind: "sell", tx: "0xnew", ts: "2026-09-20T00:00:00Z", qty: 100 },
    { kind: "sell", tx: "0xold", ts: "2026-09-01T00:00:00Z", qty: 900 },
    { kind: "buy",  tx: "0xbuy", ts: "2026-09-20T00:00:00Z", qty: 5 },
  ];
  assert.equal(pickSale(rows, { posted: [] }, { now }).tx, "0xnew");
  assert.equal(pickSale([rows[2]], { posted: [] }, { now }), null, "a buy must never fire");
  assert.equal(pickSale([rows[1]], { posted: [] }, { now }), null, "stale sells do not fire");
});

test("a sale already posted never fires twice", () => {
  const now = Date.parse("2026-09-21T00:00:00Z");
  const rows = [{ kind: "sell", tx: "0xnew", ts: "2026-09-20T00:00:00Z", qty: 100 }];
  assert.equal(pickSale(rows, { posted: [{ tx: "0xnew" }] }, { now }), null);
});

test("there is NO size floor — a small sell still fires", () => {
  const now = Date.parse("2026-09-21T00:00:00Z");
  const rows = [{ kind: "sell", tx: "0xdust", ts: "2026-09-20T00:00:00Z", qty: 2 }];
  assert.equal(pickSale(rows, { posted: [] }, { now }).qty, 2);
});

test("state records the sale and caps its own growth", () => {
  let s = { posted: [] };
  s = recordPosted(s, { tx: "0xa", token: 2451, qty: 1, ts: "2026-09-20" });
  assert.ok(alreadyPosted(s, "0xa"));
  assert.equal(alreadyPosted(s, "0xb"), false);
  for (let i = 0; i < 300; i++) s = recordPosted(s, { tx: `0x${i}`, token: 2451, qty: 1, ts: "2026-09-20" }, 200);
  assert.equal(s.posted.length, 200);
});

test("the copy carries the transaction hash and stays inside the instant-read ceiling", () => {
  const tx = "0x" + "a".repeat(64);
  const text = withFooter(copyFor({ token: 2451, rank: 2, qty: 401900, usd: 213000, tx }));
  assert.ok(text.includes(tx), "the receipt is the whole point");
  assert.ok(xLen(text) <= 290, `worst-case copy is ${xLen(text)}, ceiling is 290`);
  assert.equal(copyFor({ token: 2451, rank: 2, qty: 1, tx }).split("\n").length, 3,
    "house style is exactly three lines");
});

test("the copy states NO aggregate totals", () => {
  // "bought X, sold Y, holds Z" invites a subtraction that does not close without the
  // transfer legs: 1,092,500 - 836,673 = 255,827, but the household holds 410,623, because
  // 421,602 arrived and 266,806 left by plain transfer. The arithmetic is right; a reader
  // doing that sum still concludes the account cannot count. One number only — the event.
  const text = copyFor({ token: 2451, rank: 2, qty: 1360, usd: 722, tx: "0xabc" });
  const numbers = (text.replace(/0x[0-9a-f]+/gi, "").match(/[\d,]+/g) || [])
    .map(n => n.replace(/^,|,$/g, ""));
  assert.ok(!/% of what it bought|still holds/i.test(text), "no aggregate claims");
  assert.ok(numbers.every(n => ["1,360", "722", "2451", "2", "3,333"].includes(n)),
    `only the event, the token and its rank may appear — found ${numbers.join(" ")}`);
});

test("the registry hands the watcher every wallet, not the two named in prose", () => {
  const c = clusterOf(2451);
  assert.equal(c.wallets.length, 6);
  assert.ok(c.wallets.includes("0x210ccbd54e277267123e3c173f8626feefa2fb5b"), "the 401,900 vault must be tracked");
});

test("log ticks land on round numbers across the whole range", () => {
  assert.deepEqual(logTicks(0.002, 0.5), [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5]);
});
