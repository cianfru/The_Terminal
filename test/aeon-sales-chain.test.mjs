import test from "node:test";
import assert from "node:assert/strict";
import { decodeSales, venueOf } from "../scripts/build-aeon-sales-chain.mjs";

const AEON = "0xc374a204334d4edd4c6a62f0867c752d65e9579c";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const POOL = "0x0000000000a39bb272e79075ade125fd351887ac";
const ZERO = "0x0000000000000000000000000000000000000000";
const SEAPORT = "0x0000000000000068f116a894984e2db1123eb395", BLUR = "0x000000000000ad05ccc4f10045630fb830b95127";
const A = "0x" + "a".repeat(40), B = "0x" + "b".repeat(40), C = "0x" + "c".repeat(40), F = "0x" + "f".repeat(40);
const nft = (from, to, id, token = AEON) => ({ from, to, token, type: "ERC-721", id, value: 0 });
const erc20 = (from, to, value, token = WETH) => ({ from, to, token, type: "ERC-20", id: null, value });
const tx = (from, to, eth = 0) => ({ from, to, toName: "", value: String(BigInt(Math.round(eth * 1e6)) * 10n ** 12n), ts: "2026-09-22T10:00:00Z" });

test("bought outright with ETH: the price is the transaction value", () => {
  const [s] = decodeSales("0x1", tx(B, SEAPORT, 0.55), [nft(A, B, 12)]);
  assert.equal(s.price, 0.55); assert.equal(s.buyer, B); assert.equal(s.seller, A); assert.equal(s.market, "opensea"); assert.equal(s.currency, "ETH");
});

test("a sweep splits the ETH across every NFT the buyer received, other collections included", () => {
  const legs = [nft(A, B, 1), nft(C, B, 2), nft(F, B, 7, "0x" + "9".repeat(40))];
  const out = decodeSales("0x2", tx(B, BLUR, 1.5), legs);
  assert.equal(out.length, 2, "only the AEON legs are sales");
  assert.ok(out.every(s => s.price === 0.5 && s.market === "blur"));
});

test("an accepted WETH bid: the gross the bidder paid, fees included", () => {
  const legs = [nft(A, B, 5), erc20(B, A, 0.475), erc20(B, F, 0.025)];
  const [s] = decodeSales("0x3", tx(A, SEAPORT, 0), legs);
  assert.equal(s.price, 0.5); assert.equal(s.currency, "WETH");
});

test("a Blur pool bid counts as ETH", () => {
  const [s] = decodeSales("0x4", tx(A, BLUR, 0), [nft(A, B, 5), erc20(B, A, 0.6, POOL)]);
  assert.equal(s.price, 0.6); assert.equal(s.currency, "ETH");
});

test("one seller filling several bidders: each sale priced from its own bidder", () => {
  const legs = [nft(A, B, 1), nft(A, C, 2), erc20(B, A, 0.5, POOL), erc20(C, A, 0.7, POOL)];
  const out = decodeSales("0x5", tx(A, BLUR, 0), legs);
  assert.deepEqual(out.map(s => [s.id, s.price]), [[1, 0.5], [2, 0.7]]);
});

test("no payment from the buyer is a gift or a wallet move, never a sale", () => {
  assert.deepEqual(decodeSales("0x6", tx(A, AEON, 0), [nft(A, B, 3)]), []);
  // the SELLER sending ETH does not make it a sale
  assert.deepEqual(decodeSales("0x7", tx(A, AEON, 0.2), [nft(A, B, 3)]), []);
});

test("mints are not sales", () => {
  assert.deepEqual(decodeSales("0x8", tx(B, AEON, 0.1), [nft(ZERO, B, 4)]), []);
});

test("venue from the router address, then the contract name", () => {
  assert.equal(venueOf(SEAPORT, ""), "opensea");
  assert.equal(venueOf(BLUR, ""), "blur");
  assert.equal(venueOf("0x" + "1".repeat(40), "LSSVMPair"), "sudoswap");
  assert.equal(venueOf("0x" + "1".repeat(40), ""), "other");
});

test("ETH the marketplace refunds to the buyer is not part of the price", () => {
  const [s] = decodeSales("0x9", tx(B, SEAPORT, 0.635), [nft(A, B, 2202)], [{ from: SEAPORT, to: B, eth: 0.108 }, { from: SEAPORT, to: A, eth: 0.5 }]);
  assert.equal(s.price, 0.527);
});

test("a smart wallet buying through a relayer pays from inside the transaction", () => {
  const RELAYER = "0x" + "e".repeat(40);
  const [s] = decodeSales("0xa", tx(RELAYER, "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789", 0), [nft(A, B, 1645)], [{ from: B, to: SEAPORT, eth: 0.983 }]);
  assert.equal(s.price, 0.983); assert.equal(s.buyer, B);
});
