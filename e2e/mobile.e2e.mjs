// Mobile smoke test — the automated version of the project rule "verify every surface on a phone
// viewport". Runs against a built site served by `vite preview` (see scripts/e2e.mjs / npm run test:e2e).
// Guards the class of bug found 2026-09-11: the ☰ toggle sat 40px OFF-SCREEN on every phone.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, devices } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:4173";
const WIDTHS = [320, 360, 390, 430];   // iPhone SE 1st-gen upward
const ROUTES = ["/?view=charts", "/?chart=hodlwaves", "/?view=docs", "/deepfield"];
let browser;
before(async () => { browser = await chromium.launch({ executablePath: process.env.E2E_CHROME || undefined }); });
after(async () => { await browser?.close(); });

const phone = w => ({ ...devices["iPhone 13"], viewport: { width: w, height: 844 }, hasTouch: true, isMobile: true });
const geom = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s); if (!el) return null;
  const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, h: r.height, vw: innerWidth, display: getComputedStyle(el).display };
}, sel);
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));

for (const w of WIDTHS) {
  for (const route of ROUTES) {
    test(`${w}px ${route}: ☰ toggle on-screen, no sideways scroll`, async () => {
      const ctx = await browser.newContext(phone(w));
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      const tog = await geom(page, ".tmobtog");
      assert.ok(tog && tog.display !== "none", "toggle rendered");
      assert.ok(tog.r <= w && tog.l >= 0, `toggle inside viewport (left ${tog.l} right ${tog.r} of ${w})`);
      assert.ok(tog.w >= 40 && tog.h >= 40, "toggle is a ≥40px tap target");
      const bar = await geom(page, ".tbar");
      assert.ok(bar.r <= w, `header bar fits (right ${bar.r} of ${w})`);
      const o = await overflow(page);
      assert.equal(o.sw, o.cw, `page does not scroll sideways (${o.sw} vs ${o.cw})`);
      // WCAG 2.5.5 / Apple HIG: every control left in the header is a ≥44px target
      const small = await page.evaluate(() => [...document.querySelectorAll(".tbar a, .tbar button")]
        .map(el => ({ c: el.className || el.tagName, r: el.getBoundingClientRect() }))
        .filter(x => x.r.width > 0 && (x.r.width < 44 || x.r.height < 44))
        .map(x => `${x.c} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`));
      assert.deepEqual(small, [], "header controls are all ≥44px");
      // the menu really opens
      await page.tap(".tmobtog");
      await page.waitForTimeout(400);
      const sb = await geom(page, ".tsb.open");
      assert.ok(sb && sb.display !== "none", "springboard opens on tap");
      assert.ok(await page.$(".tsb.open .tsbdock .tsbdocki"), "dock carries the social/login chips");
      await ctx.close();
    });
  }

  test(`${w}px landing (/): ☰ toggle on-screen inside the iframe, no sideways scroll`, async () => {
    const ctx = await browser.newContext(phone(w));
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const fr = page.frames().find(f => f.url().includes("landing-next"));
    assert.ok(fr, "landing iframe mounted");
    const m = await fr.evaluate(() => {
      const t = document.querySelector("#mobtog"); const r = t.getBoundingClientRect();
      return { l: r.left, r: r.right, display: getComputedStyle(t).display, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    });
    assert.notEqual(m.display, "none", "landing toggle shown");
    assert.ok(m.r <= m.cw && m.l >= 0, `landing toggle inside viewport (right ${m.r} of ${m.cw})`);
    assert.equal(m.sw, m.cw, `landing does not scroll sideways (${m.sw} vs ${m.cw})`);
    await ctx.close();
  });
}

test("390px: fullscreen is offered on phones (FullscreenView is built for them)", async () => {
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
  const titles = await page.$$eval(".tchart button", bs => bs.map(b => b.getAttribute("title") || ""));
  assert.ok(titles.some(t => /full-screen/i.test(t)), `fullscreen button present (saw ${JSON.stringify(titles)})`);
  await ctx.close();
});

test("390px home: the React shell under the landing iframe is inert (no duplicate nav)", async () => {
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const nav = await page.evaluate(() => {
    const n = document.querySelector("nav[aria-hidden='true']") || document.querySelector("nav");
    return n ? { inert: n.hasAttribute("inert"), hidden: n.getAttribute("aria-hidden") } : null;
  });
  assert.ok(nav, "a nav exists beneath the iframe");
  assert.equal(nav.inert, true, "covered nav is inert");
  assert.equal(nav.hidden, "true", "covered nav is aria-hidden");
  await ctx.close();
});

test("390px: touch charts point at fullscreen pinch, not a swipe that would flip the chart", async () => {
  // The chart page binds a horizontal flick to the chart-to-chart pager, so the zoom affordance on
  // touch MUST be fullscreen + pinch. A "swipe to zoom" caption here would teach a broken gesture.
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  assert.equal(await page.$(".zoomhint-box"), null, "the animated MOUSE hint is hidden on a touch device");
  const cap = (await page.textContent(".chart-zoombar")) || "";
  assert.match(cap, /fullscreen/i, `caption routes to fullscreen (saw "${cap.trim()}")`);
  assert.doesNotMatch(cap, /\bdrag\b|\bswipe\b/i, "caption never asks for a gesture the pager owns");
  const handlers = await page.evaluate(() => getComputedStyle(document.querySelector(".recharts-wrapper")).touchAction);
  assert.equal(handlers, "pan-y", "chart keeps vertical scrolling and leaves horizontal to the pager");
  await ctx.close();
});

test("760px band: JS isMobile and the CSS hamburger agree (no desktop layout under a phone menu)", async () => {
  for (const w of [700, 760, 761]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
    const tog = await geom(page, ".tmobtog");
    const mobile = w <= 760;
    assert.equal(tog.display !== "none", mobile, `${w}px: hamburger ${mobile ? "shown" : "hidden"}`);
    const jsMobile = await page.evaluate(() => matchMedia("(max-width:760px)").matches);
    assert.equal(jsMobile, mobile, `${w}px: JS breakpoint agrees`);
    await ctx.close();
  }
});

test("390px Explore: search, chips and rails make a 73-chart catalogue reachable", async () => {
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  // seed a view so the Recently-viewed rail has something in it
  await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.goto(BASE + "/?view=charts", { waitUntil: "networkidle" });
  await page.tap(".tmobtog");
  await page.waitForTimeout(500);

  // search: title matches lead
  await page.fill(".tsbsearchin", "whale");
  await page.waitForTimeout(400);
  const names = await page.$$eval(".tsbrownm", els => els.map(e => e.textContent));
  assert.ok(names.length >= 4, `search returns results (${names.length})`);
  assert.ok(/whale/i.test(names[0]), `title hits rank first (got "${names[0]}")`);

  // a chip narrows rather than dumping the catalogue
  await page.fill(".tsbsearchin", "");
  await page.waitForTimeout(300);
  await page.tap(".tsbchip >> nth=0");
  await page.waitForTimeout(400);
  const chipCount = (await page.$$(".tsbrownm")).length;
  assert.ok(chipCount > 0 && chipCount < 30, `chip filters to a usable set (${chipCount})`);

  // saving a chart puts it on the Saved rail
  await page.tap(".tsbstar >> nth=0");
  await page.waitForTimeout(300);
  await page.tap(".tsbchip >> nth=0");            // clear the chip, back to the rails
  await page.waitForTimeout(400);
  const rails = await page.$$eval(".tsbrailh", els => els.map(e => e.textContent));
  assert.ok(rails.some(r => /Saved/i.test(r)), `Saved rail appears (${JSON.stringify(rails)})`);
  assert.ok(rails.some(r => /Recently viewed/i.test(r)), "Recently viewed rail appears");
  assert.ok(rails.some(r => /New/i.test(r)), "New rail appears");

  // the root view still fits and still scrolls in one direction only
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.equal(o.sw, o.cw, "Explore does not scroll sideways");

  // the destination tiles must not collide with what follows them
  const overlap = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".tsbcell")].map(e => e.getBoundingClientRect());
    const df = document.querySelector(".tsbdf")?.getBoundingClientRect();
    if (!df || cells.length < 4) return "missing";
    return cells.some(c => c.bottom > df.top + 1) ? "overlap" : "ok";
  });
  assert.equal(overlap, "ok", "destination tiles clear the Deep Field strip");
  await ctx.close();
});

test("390px: the search field can't trigger iOS zoom-on-focus", async () => {
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  await page.goto(BASE + "/?view=charts", { waitUntil: "networkidle" });
  await page.tap(".tmobtog");
  await page.waitForTimeout(400);
  const fs = await page.$eval(".tsbsearchin", e => parseFloat(getComputedStyle(e).fontSize));
  assert.ok(fs >= 16, `search input is >=16px (${fs}px) — Safari zooms the page below that`);
  await ctx.close();
});

test("390px: the mobile chart system holds across charts, migrated or not", async () => {
  // The floors live in CSS so they reach every chart, including ones still carrying their own
  // `isMobile ? 10 : 12`. mvrv and cexvenues are deliberately NOT migrated to chart-tokens.js.
  const ctx = await browser.newContext(phone(390));
  for (const route of ["hodlwaves", "valuation", "mvrv", "cexvenues", "nupl", "concentration"]) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?chart=${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);
    const m = await page.evaluate(() => {
      const svg = document.querySelector(".recharts-wrapper svg");
      const ticks = [...document.querySelectorAll(".recharts-cartesian-axis-tick-value")];
      const sb = svg?.getBoundingClientRect();
      return {
        minTick: ticks.length ? Math.min(...ticks.map(t => parseFloat(getComputedStyle(t).fontSize))) : null,
        explain: (e => e ? parseFloat(getComputedStyle(e).fontSize) : null)(document.querySelector(".chart-explain")),
        caption: (e => e ? parseFloat(getComputedStyle(e).fontSize) : null)(document.querySelector(".chart-caption")),
        clipped: !sb ? [] : ticks.filter(t => t.getBoundingClientRect().width > 0
          && (t.getBoundingClientRect().left < sb.left - 0.5 || t.getBoundingClientRect().right > sb.right + 0.5)).map(t => t.textContent),
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      };
    });
    assert.ok(m.minTick === null || m.minTick >= 12, `${route}: axis text >=12px (got ${m.minTick})`);
    if (m.explain !== null) assert.ok(m.explain >= 16, `${route}: explainer >=16px (got ${m.explain})`);
    if (m.caption !== null) assert.ok(m.caption >= 15, `${route}: caption >=15px (got ${m.caption})`);
    assert.deepEqual(m.clipped, [], `${route}: no axis label is cut off by the plot edge`);
    assert.equal(m.sw, m.cw, `${route}: no sideways scroll`);
    await page.close();
  }
  await ctx.close();
});

test("390px: view toggles sit in a sticky toolbar that survives scrolling", async () => {
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  await page.goto(BASE + "/?chart=mvrv", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => {
    const t = document.querySelector(".chart-toolbar");
    return t ? { pos: getComputedStyle(t).position, overflowX: getComputedStyle(t).overflowX } : null;
  });
  assert.ok(before, "the chart has a toolbar");
  assert.equal(before.pos, "sticky");
  assert.equal(before.overflowX, "auto", "toggles scroll sideways rather than wrapping");
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(400);
  const top = await page.evaluate(() => Math.round(document.querySelector(".chart-toolbar").getBoundingClientRect().top));
  assert.ok(top >= 0 && top < 200, `toolbar stays in reach after scrolling (top ${top})`);
  await ctx.close();
});

test("390px: the insight line answers the chart before the plot does", async () => {
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const ins = await page.evaluate(() => {
    const el = document.querySelector(".chart-insight");
    if (!el) return null;
    const plot = document.querySelector(".recharts-wrapper");
    return { v: el.querySelector(".chart-insight-v")?.textContent, d: el.querySelector(".chart-insight-d")?.textContent,
      m: el.querySelector(".chart-insight-m")?.textContent, abovePlot: el.getBoundingClientRect().top < plot.getBoundingClientRect().top };
  });
  assert.ok(ins, "insight rendered");
  assert.match(ins.v, /%/, "carries the current value");
  assert.match(ins.d, /90 days/, "carries a direction over a stated window");
  assert.ok(ins.m && ins.m.length > 20, "says what it means in plain words");
  assert.ok(ins.abovePlot, "sits above the plot");
  await ctx.close();
});

test("390px: a chart page stays inside its layout-shift budget", async () => {
  // Measured 0.171 before reserving the lazy chart's height — the pager jumped ~700px on mount.
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const cls = await page.evaluate(() => window.__cls);
  assert.ok(cls <= 0.1, `CLS within budget (got ${cls.toFixed(3)})`);
  await ctx.close();
});

test("390px: the gallery mounts no chart chunks and fetches each feed once", async () => {
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  const urls = [];
  page.on("request", r => urls.push(r.url()));
  await page.goto(BASE + "/?view=charts", { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2500);
  // ChartsGallery is the PAGE's own chunk — legitimate. What must not appear is a per-chart
  // component chunk, which would mean a tile mounted a real chart.
  const chartChunks = urls.filter(u => /\/assets\/[A-Za-z]*Chart[A-Za-z]*-/.test(u) && !u.includes("ChartsGallery"));
  assert.deepEqual(chartChunks.map(u => u.split("/").pop()), [], "no per-chart chunk is fetched for a tile");
  await ctx.close();
});

test("390px: a chart page downloads each data feed exactly once", async () => {
  // onchain.json was pulled twice — once by the chart, once by the freshness tag — at 249KB a copy.
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  const feeds = [];
  page.on("request", r => { const u = r.url(); if (/\.json(\?|$)/.test(u) && !u.includes("version")) feeds.push(u.split("/").pop().split("?")[0]); });
  await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const dupes = feeds.filter((f, i) => feeds.indexOf(f) !== i);
  assert.deepEqual([...new Set(dupes)], [], `no feed is fetched twice (saw ${JSON.stringify(feeds)})`);
  await ctx.close();
});
