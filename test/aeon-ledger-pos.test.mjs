import test from "node:test";
import assert from "node:assert/strict";
import { priceLookup, positionFromTrades, aeonThumb } from "../src/aeon-ledger-pos.js";
import { pnlOf } from "../research/pfp-forensics/landscape/export.mjs";

const px = [{ date: "2024-01-01", price: 0.01 }, { date: "2024-06-01", price: 0.5 }, { date: "2025-01-01", price: 1 }];

test("price lookup carries the last close forward and knows nothing before the first", () => {
  const p = priceLookup(px);
  assert.equal(p("2024-06-01"), 0.5); assert.equal(p("2024-09-09"), 0.5); assert.equal(p("2030-01-01"), 1); assert.equal(p("2023-01-01"), 0);
});

test("the ledger's P&L IS the sheet's replay (one function)", () => {
  const trades = [["2024-01-01T00:00:00Z", "buy", 1000], ["2024-01-01T00:00:00Z", "in", 500], ["2024-06-01T00:00:00Z", "sell", 600],
    ["2024-06-01T00:00:00Z", "out", 100], ["2025-01-01T00:00:00Z", "rotation", 200], ["2025-01-01T00:00:00Z", "buy", 50]];
  const p = priceLookup(px);
  const a = positionFromTrades(trades, p, 650, 1), b = pnlOf(trades, p, 1, 650);
  assert.equal(a.realized, b.realized); assert.equal(a.avgCost, b.avgCost); assert.equal(a.unrealized, b.unrealized);
  assert.equal(a.buys.length, 2, "a receipt is not drawn as a purchase");
  assert.equal(a.sells.length, 2, "a rotation out of SPX is a sale");
  assert.equal(a.received, 500); assert.equal(a.sentOut, 100);
});

test("buys and sells count what actually changed hands, not the day's close", () => {
  const p = priceLookup(px);
  const a = positionFromTrades([["2024-01-01T00:00:00Z", "buy", 1000, 30, "wallet"], ["2024-06-01T00:00:00Z", "sell", 1000, 420, "pool"]], p, 0);
  assert.equal(a.invested, 30); assert.equal(a.proceeds, 420); assert.equal(a.realized, 390);
  assert.equal(a.buys[0][1], 0.03, "the orb sits at the price paid");
});

test("collateral that comes back returns at its cost, not at the price on the day it came back (case #14, Morpho)", () => {
  const p = d => ({ "2023-09-02": 0.002, "2025-07-15": 1.6, "2025-07-23": 1.8, "2026-09-07": 0.55 })[d] || 0;
  const morpho = "0xbbbbbbbb";
  const trades = [["2023-09-02T00:00:00Z", "buy", 2000000, 4000, "wallet"],
    ["2025-07-15T00:00:00Z", "out", 2000000, null, morpho], ["2025-07-23T00:00:00Z", "in", 2000000, null, morpho],
    ["2026-09-07T00:00:00Z", "sell", 1000000, 550000, "wallet"]];
  const a = positionFromTrades(trades, p, 1000000, 0.5);
  assert.equal(a.avgCost, 0.002, "still the 2023 cost");
  assert.equal(a.realized, 548000);
  assert.equal(a.returned, 2000000); assert.equal(a.receivedAtMarket, 0);
});

test("liquidity out to a pool and back from the position manager is one round trip", () => {
  const p = d => ({ "2023-11-13": 0.01, "2023-11-15": 0.03 })[d] || 0;
  const a = positionFromTrades([["2023-11-01T00:00:00Z", "buy", 100, 1, "wallet"],
    ["2023-11-13T00:00:00Z", "lpOut", 100, null, "0x00ed26e7"], ["2023-11-15T00:00:00Z", "lpIn", 110, null, "0xc36442b4"]], p, 110);
  assert.ok(Math.abs(a.avgCost - (1 + 10 * 0.03) / 110) < 1e-12, "100 back at cost, the 10 extra at market");
  assert.equal(a.returned, 100); assert.equal(a.receivedAtMarket, 10);
});

test("a receipt from someone it never sent to is a new coin, entered at the day's close", () => {
  const p = d => ({ "2024-01-01": 0.1, "2024-06-01": 0.5 })[d] || 0;
  const a = positionFromTrades([["2024-01-01T00:00:00Z", "buy", 100, 10, "wallet"], ["2024-01-01T00:00:00Z", "out", 100, null, "0xaaaaaaaa"],
    ["2024-06-01T00:00:00Z", "in", 100, null, "0xcccccccc"]], p, 100);
  assert.equal(a.avgCost, 0.5); assert.equal(a.returned, 0); assert.equal(a.receivedAtMarket, 100);
});

test("thumbnails come from the image service; anything else passes through", () => {
  assert.equal(aeonThumb("https://nft2-cdn.alchemy.com/eth-mainnet/1c390554d9f78e52dbb952e560040141"),
    "https://res.cloudinary.com/alchemyapi/image/upload/thumbnailv2/eth-mainnet/1c390554d9f78e52dbb952e560040141");
  assert.equal(aeonThumb("https://ipfs.io/x.png"), "https://ipfs.io/x.png");
  assert.equal(aeonThumb(null), null);
});
