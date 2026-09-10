import test from "node:test";
import assert from "node:assert/strict";
import { selectForDeletion } from "../scripts/prune-vercel-deployments.mjs";

const D = (uid, daysAgo, state = "READY", target = null, extra = {}) =>
  ({ uid, created: Date.now() - daysAgo * 864e5, state, target, ...extra });

test("never deletes the live production deployment, even when old", () => {
  const live = D("live", 30, "READY", "production");
  const { remove, live: found } = selectForDeletion([live, ...Array.from({ length: 10 }, (_, i) => D("p" + i, i))], 3);
  assert.equal(found.uid, "live");
  assert.ok(!remove.some(d => d.uid === "live"));
});

test("never deletes in-flight builds", () => {
  const { remove } = selectForDeletion([D("b", 40, "BUILDING"), D("q", 41, "QUEUED"), ...Array.from({ length: 8 }, (_, i) => D("p" + i, i))], 2);
  assert.ok(!remove.some(d => d.uid === "b" || d.uid === "q"));
});

test("keeps the newest N as rollback candidates and removes the rest", () => {
  const ds = Array.from({ length: 12 }, (_, i) => D("p" + i, i, "READY", i === 0 ? "production" : null));
  const { keep, remove } = selectForDeletion(ds, 4);
  assert.deepEqual(keep.map(d => d.uid), ["p0", "p1", "p2", "p3"]);
  assert.equal(remove.length, 8);
  assert.ok(remove.every(d => Number(d.uid.slice(1)) >= 4));
});

test("keeps any aliased deployment", () => {
  const { remove } = selectForDeletion([D("al", 50, "READY", null, { alias: ["preview.example.com"] }), ...Array.from({ length: 8 }, (_, i) => D("p" + i, i))], 2);
  assert.ok(!remove.some(d => d.uid === "al"));
});

test("removes old ERROR/CANCELED deployments", () => {
  const { remove } = selectForDeletion([D("e", 20, "ERROR"), D("c", 21, "CANCELED"), D("live", 0, "READY", "production")], 1);
  assert.deepEqual(remove.map(d => d.uid).sort(), ["c", "e"]);
});
