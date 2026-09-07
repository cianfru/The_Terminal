import { test } from "node:test";
import assert from "node:assert/strict";
import { median, monthlyMultiple, shieldShare, summarize } from "../scripts/zec-dormancy.mjs";

test("median: odd, even, junk-tolerant, empty", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([1, NaN, 3]), 2);
  assert.equal(median([]), null);
});

test("monthlyMultiple: scales a month against a daily baseline", () => {
  assert.equal(monthlyMultiple(300, 10, 30), 1);      // exactly baseline
  assert.equal(monthlyMultiple(1140, 10, 30), 3.8);   // the Aug-2025 reading
  assert.equal(monthlyMultiple(100, 0), null);
});

test("shieldShare: clamps to [0,1] so the hedge can't overstate", () => {
  assert.equal(shieldShare(50, 100), 0.5);
  assert.equal(shieldShare(500, 100), 1);             // shielding alone covers it
  assert.equal(shieldShare(-20, 100), 0);             // net deshielding explains none
  assert.equal(shieldShare(10, 0), null);
});

test("summarize: multiples are relative to the pre-runup baseline median", () => {
  const rows = [
    { d: "2024-06-01", cdd: 100 }, { d: "2025-01-01", cdd: 300 },
    { d: "2025-08-01", cdd: 600 },                     // after the baseline window
  ];
  const out = summarize(rows);
  assert.equal(out[2].mult, 3);                        // 600 / median(100,300)=200
});
