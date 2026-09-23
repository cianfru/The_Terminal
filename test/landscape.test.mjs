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
