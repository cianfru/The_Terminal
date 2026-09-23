import { test } from "node:test";
import assert from "node:assert/strict";
import { CHART_INDEX, TOPICS, chartsForTopic, searchCharts, newestCharts, addedOn, START_HERE } from "../src/chart-index.js";
import { CHART_META } from "../src/charts-catalog.js";

test("the index covers every listed chart and nothing dev-only", () => {
  const listed = Object.values(CHART_META).filter(c => !c.dev);
  assert.equal(CHART_INDEX.length, listed.length);
  assert.ok(!CHART_INDEX.some(c => c.dev), "dev charts stay direct-link-only");
  assert.ok(CHART_INDEX.every(c => c.href === `/?chart=${c.id}`), "href matches the deep link the app reads");
});

test("every chart carries at least one plain-language topic", () => {
  const untagged = CHART_INDEX.filter(c => !c.topics.length).map(c => c.id);
  assert.deepEqual(untagged, [], "an untagged chart is unreachable by chip");
});

test("a chip is a filter, not a dump — no topic swallows the catalogue", () => {
  for (const t of TOPICS) {
    const n = chartsForTopic(t).length;
    assert.ok(n > 0, `${t} matches nothing`);
    assert.ok(n <= CHART_INDEX.length * 0.3, `${t} returns ${n}/${CHART_INDEX.length} — too broad to filter`);
  }
});

test("NFT charts answer only the NFT chip (an AEON holder is not an SPX holder)", () => {
  const aeon = CHART_INDEX.filter(c => c.section === "aeon");
  assert.ok(aeon.length > 0);
  assert.ok(aeon.every(c => c.topics.includes("NFTs")), "all Aeon charts are NFTs");
  assert.ok(!chartsForTopic("Holders").some(c => c.section === "aeon"), "Aeon never appears under Holders");
});

test("search ranks title hits above description mentions", () => {
  const r = searchCharts("whale");
  assert.ok(r.length > 3);
  const firstFour = r.slice(0, 4).map(c => c.title);
  assert.ok(firstFour.every(t => /whale/i.test(t)), `titles lead: ${JSON.stringify(firstFour)}`);
});

test("search is AND across terms, and matches id, group and topic", () => {
  assert.ok(searchCharts("hodl waves").some(c => c.id === "hodlwaves"));
  assert.ok(searchCharts("mvrv").some(c => c.id === "mvrv"), "id match");
  assert.ok(searchCharts("exchanges").length > 0, "group match");
  assert.deepEqual(searchCharts("zzzznope"), [], "no match returns empty, never everything");
  assert.deepEqual(searchCharts(""), [], "an empty query is not a wildcard");
});

test("search can be scoped to a chip's charts", () => {
  const scoped = searchCharts("supply", chartsForTopic("Exchanges"));
  assert.ok(scoped.every(c => c.topics.includes("Exchanges")));
});

test("'New' is dated from the repo, newest first — a fact, not an editorial claim", () => {
  const n = newestCharts(5);
  assert.equal(n.length, 5);
  const dates = n.map(c => addedOn(c.id));
  assert.ok(dates.every(Boolean), "every listed chart has a date");
  assert.deepEqual(dates, [...dates].sort().reverse(), "newest first");
  assert.ok(dates.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)), "ISO dates");
});

test("the curated shortlist is real charts, and there is no invented 'Popular' rail", async () => {
  assert.ok(START_HERE.length >= 4);
  assert.ok(START_HERE.every(c => CHART_INDEX.includes(c)), "every pick exists in the catalogue");
  const src = await import("node:fs").then(fs => fs.readFileSync(new URL("../src/chart-index.js", import.meta.url), "utf8"));
  assert.ok(!/export const POPULAR/.test(src), "popularity needs data we don't have; don't fake a ranking");
});
