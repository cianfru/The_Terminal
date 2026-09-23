import test from "node:test";
import assert from "node:assert/strict";
import { classify, owners, clusterAeon, score, readCsv, ZERO } from "../scripts/build-aeon-clusters.mjs";

const T = (from, to, id, time) => ({ from_address: from, to_address: to, token_id: id, time });
const S = (seller, buyer, id, time, price = 1) =>
  ({ seller, buyer, token_id: id, time, price: String(price), currency_symbol: "ETH" });

test("a transfer matching the sales feed is a sale, everything else is free", () => {
  const tr = [T(ZERO, "0xa", "1", "2024-01-01 00:00:00.000 UTC"),
              T("0xa", "0xb", "1", "2024-02-01 00:00:00.000 UTC"),
              T("0xb", "0xc", "1", "2024-03-01 00:00:00.000 UTC")];
  const tagged = classify(tr, [S("0xa", "0xb", "1", "2024-02-01 00:00:00.000 UTC")]);
  assert.deepEqual(tagged.map(t => t.kind), ["mint", "sale", "free"]);
});

test("current owner comes from the last transfer", () => {
  const tagged = classify([T(ZERO, "0xa", "7", "2024-01-01 00:00:00.000 UTC"),
                           T("0xa", "0xb", "7", "2024-06-01 00:00:00.000 UTC")], []);
  assert.equal(owners(tagged).get("7"), "0xb");
});

test("a single free transfer is a gift and must NOT link two wallets", () => {
  const tagged = classify([T("0xa", "0xb", "1", "2024-01-01 00:00:00.000 UTC")], []);
  const { clusters } = clusterAeon(tagged);
  assert.equal(clusters.filter(c => c.wallets.length > 1).length, 0);
});

test("moving three tokens to the same wallet links them", () => {
  const tr = ["1", "2", "3"].map(id => T("0xa", "0xb", id, `2024-0${id}-01 00:00:00.000 UTC`));
  const { clusters } = clusterAeon(classify(tr, []));
  const c = clusters.find(c => c.wallets.length > 1);
  assert.deepEqual(c.wallets, ["0xa", "0xb"]);
});

test("a sale never links, however many tokens move", () => {
  const tr = ["1", "2", "3", "4"].map(id => T("0xa", "0xb", id, `2024-0${id}-01 00:00:00.000 UTC`));
  const sales = tr.map(t => S("0xa", "0xb", t.token_id, t.time));
  const { clusters } = clusterAeon(classify(tr, sales));
  assert.equal(clusters.filter(c => c.wallets.length > 1).length, 0);
});

test("contracts are never linked — a marketplace would fuse everyone", () => {
  const tr = ["1", "2", "3"].map(id => T("0xmarket", "0xb", id, `2024-0${id}-01 00:00:00.000 UTC`));
  const { clusters } = clusterAeon(classify(tr, []), { isContract: a => a === "0xmarket" });
  assert.equal(clusters.filter(c => c.wallets.length > 1).length, 0);
});

test("a fan-out distributor is dropped rather than fusing its recipients", () => {
  const tr = [];
  for (let w = 0; w < 9; w++) for (const id of [1, 2, 3])
    tr.push(T("0xhub", "0xw" + w, `${w}-${id}`, `2024-0${id}-01 00:00:00.000 UTC`));
  const { clusters, hub } = clusterAeon(classify(tr, []), { maxOut: 6 });
  assert.ok(hub.has("0xhub"));
  assert.equal(clusters.filter(c => c.wallets.length > 1).length, 0);
});

test("oversized clusters are flagged, never silently trusted", () => {
  const tr = [];
  for (let w = 0; w < 14; w++) for (const id of [1, 2, 3])
    tr.push(T("0xw" + w, "0xw" + (w + 1), `${w}-${id}`, `2024-0${id}-01 00:00:00.000 UTC`));
  const { clusters } = clusterAeon(classify(tr, []), { maxOut: 50, maxIn: 50, maxSize: 12 });
  assert.ok(clusters.find(c => c.wallets.length > 12)?.flagged);
});

test("score counts market trades but ignores moves inside the cluster", () => {
  const tr = ["1", "2", "3"].map(id => T("0xa", "0xb", id, `2024-0${id}-01 00:00:00.000 UTC`));
  tr.push(T("0xb", "0xoutsider", "1", "2024-05-01 00:00:00.000 UTC"));
  const sales = [S("0xb", "0xoutsider", "1", "2024-05-01 00:00:00.000 UTC", 2),
                 S("0xa", "0xb", "9", "2024-04-01 00:00:00.000 UTC", 5)];  // internal, must not count
  const tagged = classify(tr, sales);
  const { clusters } = clusterAeon(tagged);
  const s = score(clusters.filter(c => c.wallets.length > 1), tagged, sales, owners(tagged), "2024-06-01");
  assert.equal(s[0].soldN, 1);
  assert.equal(s[0].soldEth, 2);
});

test("readCsv keeps header order", () => {
  assert.deepEqual(readCsv("a,b\n1,2"), [{ a: "1", b: "2" }]);
});
