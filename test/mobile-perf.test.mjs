import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { qualityRatios, readQuality, QUALITIES } from "../src/city-quality.js";

const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("the freshness tag reuses the chart's data instead of fetching it again", () => {
  // It downloaded all 249KB of onchain.json to read ONE date — a quarter of a chart page on a phone.
  const f = read("src/freshness.js");
  assert.match(f, /const SHARED = \{ onchain: loadOnchain/, "onchain shares the chart's promise");
  assert.ok(!/fetch\(s\.file, \{ cache: "no-store" \}\)/.test(f), "no second no-store fetch of a shared feed");
});

test("big daily feeds may be revalidated, not re-downloaded, on a repeat visit", () => {
  const h = read("src/history-data.js");
  assert.ok(!/cache: "no-store"/.test(h), "no-store forbids even a 304; these files want no-cache");
  assert.ok(/cache: "no-cache"/.test(h));
});

test("the nav logo is not the 1408px master", () => {
  for (const f of ["src/TerminalNav.jsx", "src/Maintenance.jsx"]) {
    assert.match(read(f), /const LOGO = "\/logo_rainbow_128\.png"/, f);
  }
});

test("the lazy chart reserves its height, so the page below cannot jump", () => {
  // Measured CLS on a chart page was 0.171, over the 0.1 budget; 0.143 of it was the pager moving
  // when the chart finally mounted into a 40px-tall fallback.
  assert.match(read("src/App.jsx"), /Suspense fallback=\{<div style=\{\{ minHeight: isMobile \? \d{3} : \d{3}/);
});

test("phone gallery tiles never mount a live chart", () => {
  const g = read("src/ChartsGallery.jsx");
  assert.match(g, /isMobile \? <QuietPreview/, "mobile gets the cheap stand-in");
  assert.match(g, /rootMargin: "200px"/, "the preload margin no longer pre-mounts a screenful");
  assert.ok(!/rootMargin: "500px"/.test(g));
});

test("recharts is its own chunk, so routes that draw nothing can skip it", () => {
  assert.match(read("vite.config.js"), /return 'recharts'/);
});

test("battery saver renders far fewer pixels, and full detail is unchanged", () => {
  const saver = qualityRatios("saver", 3), full = qualityRatios("full", 3);
  assert.equal(saver.maxRatio, 1, "saver caps at 1x device pixels");
  assert.equal(full.maxRatio, 2, "full keeps the previous 2x ceiling");
  // pixels scale with the square of the ratio
  assert.ok((saver.maxRatio ** 2) / (full.maxRatio ** 2) <= 0.25, "saver is at most a quarter of the pixels");
  assert.ok(saver.minRatio > 0 && saver.minRatio <= saver.maxRatio, "the DRS floor stays below its ceiling");
  assert.equal(qualityRatios("full", 1).maxRatio, 1, "never upscales beyond the real device ratio");
});

test("quality defaults suit the device and survive a blocked localStorage", () => {
  const store = globalThis.localStorage;
  delete globalThis.localStorage;               // private mode / storage disabled
  assert.equal(readQuality(true), "saver", "phones default to saver");
  assert.equal(readQuality(false), "full", "desktops default to full");
  if (store) globalThis.localStorage = store;
  assert.deepEqual(QUALITIES, ["saver", "full"]);
});

test("vitals are bucketed and split by device, and the endpoint accepts them", () => {
  const v = read("src/vitals.js");
  assert.match(v, /largest-contentful-paint/);
  assert.match(v, /layout-shift/);
  assert.match(v, /durationThreshold/, "INP needs the event-timing observer");
  assert.match(v, /visibilitychange/, "iOS never fires unload; visibilitychange is the reliable flush");
  const api = read("api/intel.js");
  assert.match(api, /"vitals"/, "the endpoint allows the event type");
  assert.match(api, /intel:vitals/, "and tallies it");
  assert.match(api, /\$\{k\}:\$\{dev\}:\$\{r\}/, "keyed per metric PER DEVICE");
});
