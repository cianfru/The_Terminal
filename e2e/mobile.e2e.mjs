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
