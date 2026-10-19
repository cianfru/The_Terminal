import { test } from "node:test";
import assert from "node:assert/strict";
import { extendForward } from "../scripts/build-chain-wallets.mjs";

const bundle = [
  { d: "2026-07-06", eth: 49541, base: 114416, sol: 65970 },
  { d: "2026-07-13", eth: 49541, base: 114652, sol: 65968 },
];

test("forward points are rebased to the bundle level at the seam (no source-gap jump)", () => {
  const history = [
    { d: "2026-07-13", holders: 49517, holdersBase: 127285, holdersSol: 66149 }, // seam snapshot
    { d: "2026-07-14", holders: 49521, holdersBase: 127284, holdersSol: 66127 },
    { d: "2026-07-16", holders: 49522, holdersBase: 127358, holdersSol: 66133 },
  ];
  const out = extendForward(bundle, history);
  assert.equal(out.length, 4); // 2 bundle + 2 forward (07-14, 07-16; the seam day is not re-added)

  // Base offset at the seam = 114652 - 127285 = -12633 → applied to every forward point.
  const jul14 = out.find(r => r.d === "2026-07-14");
  assert.equal(jul14.base, 127284 - 12633); // 114651 — continuous with the bundle's 114652
  assert.equal(jul14.eth, 49521 + (49541 - 49517)); // +24
  assert.equal(jul14.sol, 66127 + (65968 - 66149)); // -181

  // No discontinuity: the first forward Base sits within a few hundred of the seam.
  assert.ok(Math.abs(jul14.base - bundle.at(-1).base) < 500);
});

test("a day with no Base count carries Base forward (flagged) so ETH/Solana keep updating", () => {
  const history = [
    { d: "2026-07-13", holders: 49517, holdersBase: 127285, holdersSol: 66149 },
    { d: "2026-07-14", holders: 49521, holdersBase: null, holdersSol: 66127 }, // base fetch failed
    { d: "2026-07-15", holders: 49514, holdersBase: 127310, holdersSol: 66130 },
  ];
  const out = extendForward(bundle, history);
  assert.deepEqual(out.map(r => r.d), ["2026-07-06", "2026-07-13", "2026-07-14", "2026-07-15"]);
  const jul14 = out.find(r => r.d === "2026-07-14");
  assert.equal(jul14.base, bundle.at(-1).base);   // carried from the seam level
  assert.equal(jul14.baseFill, true);
  assert.equal(jul14.sol, 66127 + (65968 - 66149));
  assert.equal(out.at(-1).baseFill, undefined);
});

test("a Base source switch is rebased to the last Base value — no jump at the handoff", () => {
  const history = [
    { d: "2026-07-13", holders: 49517, holdersBase: 127285, holdersSol: 66149 },
    { d: "2026-10-06", holders: 49198, holdersBase: 126619, holdersSol: 73311 },              // last Blockscout
    { d: "2026-10-07", holders: 49215, holdersBase: null, holdersSol: 73300 },                // Blockscout blocked
    { d: "2026-10-20", holders: 49400, holdersBase: 113900, holdersSol: 76100, holdersBaseSrc: "alchemy" },
    { d: "2026-10-21", holders: 49410, holdersBase: 113950, holdersSol: 76110, holdersBaseSrc: "alchemy" },
  ];
  const out = extendForward(bundle, history);
  const oct6 = out.find(r => r.d === "2026-10-06"), oct7 = out.find(r => r.d === "2026-10-07");
  const oct20 = out.find(r => r.d === "2026-10-20"), oct21 = out.find(r => r.d === "2026-10-21");
  assert.equal(oct6.base, 126619 - 12633);
  assert.equal(oct7.base, oct6.base); assert.equal(oct7.baseFill, true);
  assert.equal(oct20.base, oct6.base);              // continuous at the switch
  assert.equal(oct21.base - oct20.base, 50);        // then the new source's real moves
});

test("no snapshot after the seam → returns the bundle unchanged", () => {
  const out = extendForward(bundle, [{ d: "2026-07-13", holders: 49517, holdersBase: 127285, holdersSol: 66149 }]);
  assert.deepEqual(out, bundle);
});
