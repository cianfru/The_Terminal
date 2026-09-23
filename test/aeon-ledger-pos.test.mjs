import test from "node:test";
import assert from "node:assert/strict";
import { priceLookup, positionFromTrades, aeonThumb } from "../src/aeon-ledger-pos.js";
import { pnlOf } from "../research/pfp-forensics/landscape/export.mjs";

const px = [{ date: "2024-01-01", price: 0.01 }, { date: "2024-06-01", price: 0.5 }, { date: "2025-01-01", price: 1 }];

test("price lookup carries the last close forward and knows nothing before the first", () => {
  const p = priceLookup(px);
  assert.equal(p("2024-06-01"), 0.5); assert.equal(p("2024-09-09"), 0.5); assert.equal(p("2030-01-01"), 1); assert.equal(p("2023-01-01"), 0);
});

test("the sheet's replay matches the ledger's own P&L", () => {
  const trades = [["2024-01-01T00:00:00Z", "buy", 1000], ["2024-01-01T00:00:00Z", "in", 500], ["2024-06-01T00:00:00Z", "sell", 600],
    ["2024-06-01T00:00:00Z", "out", 100], ["2025-01-01T00:00:00Z", "rotation", 200], ["2025-01-01T00:00:00Z", "buy", 50]];
  const p = priceLookup(px);
  const a = positionFromTrades(trades, p, 650), b = pnlOf(trades, p, 1, 650);
  assert.ok(Math.abs(a.realized - b.realized) < 1e-9); assert.ok(Math.abs(a.avgCost - b.avgCost) < 1e-12);
  assert.equal(a.buys.length, 2, "a receipt is not drawn as a purchase");
  assert.equal(a.sells.length, 2, "a rotation out of SPX is a sale");
  assert.equal(a.received, 500); assert.equal(a.sentOut, 100);
});

test("thumbnails come from the image service; anything else passes through", () => {
  assert.equal(aeonThumb("https://nft2-cdn.alchemy.com/eth-mainnet/1c390554d9f78e52dbb952e560040141"),
    "https://res.cloudinary.com/alchemyapi/image/upload/thumbnailv2/eth-mainnet/1c390554d9f78e52dbb952e560040141");
  assert.equal(aeonThumb("https://ipfs.io/x.png"), "https://ipfs.io/x.png");
  assert.equal(aeonThumb(null), null);
});
