import test from "node:test";
import assert from "node:assert/strict";
import { cexWallets, depositTracker, ownerCexOut } from "../research/pfp-forensics/landscape/cex-out.mjs";

const A = "0x" + "a".repeat(40), B = "0x" + "b".repeat(40), D = "0x" + "d".repeat(40), F = "0x" + "f".repeat(40), G = "0x" + "9".repeat(40);
const labels = { [F]: { name: "Kraken 3", kind: "cex" }, [G]: { name: "Wintermute", kind: "cex" } };

test("exchange list keeps real venues and drops market makers / MEV bots", () => {
  const m = cexWallets(labels);
  assert.equal(m.get(F), "Kraken"); assert.equal(m.has(G), false);
});

test("a deposit address passes on everything it gets, to an exchange", () => {
  const cex = cexWallets(labels), t = depositTracker(cex);
  t.add(A, D, 100); t.add(D, F, 100);             // D: in 100, out 100 → all to Kraken
  t.add(A, B, 50); t.add(B, F, 10); t.add(B, A, 40);  // B: mostly sends elsewhere → not a deposit
  const dep = t.deposits(new Set(), labels);
  assert.equal(dep.get(D), "Kraken"); assert.equal(dep.has(B), false);
  assert.equal(t.deposits(new Set([D]), labels).has(D), false, "a household wallet is never a deposit address");
});

test("owner exchange flow: sent, withdrawn back, net; sales and internal moves skipped", () => {
  const cex = cexWallets(labels), deps = new Map([[D, "Kraken"]]);
  const owners = [{ key: A, wallets: [A, B] }];
  const tr = [[A, D, 100, "2025-01-01T00:00:00"], [A, F, 50, "2025-02-01T00:00:00"], [F, B, 30, "2025-03-01T00:00:00"],
    [A, B, 999, "2025-01-05T00:00:00"], [A, F, 7, "2025-04-01T00:00:00"]];
  const r = ownerCexOut(tr, owners, cex, deps, () => 2, (k, ts) => ts.startsWith("2025-04"))[A];
  assert.equal(r.qty, 150); assert.equal(r.viaDeposit, 100); assert.equal(r.back, 30); assert.equal(r.net, 120);
  assert.equal(r.usd, 300); assert.deepEqual(r.venues, { Kraken: 150 }); assert.equal(r.last, "2025-02-01");
});
