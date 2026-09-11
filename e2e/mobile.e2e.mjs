// Mobile smoke test — the automated version of the project rule "verify every surface on a phone
// viewport". Runs against a built site served by `vite preview` (see scripts/e2e.mjs / npm run test:e2e).
// Guards the class of bug found 2026-09-11: the ☰ toggle sat 40px OFF-SCREEN on every phone.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, devices } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:4173";
const WIDTHS = [360, 390, 430];
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

test("390px: a sideways swipe zooms a chart (touch drag-to-zoom), no mouse hint overlay", async () => {
  const ctx = await browser.newContext(phone(390));
  const page = await ctx.newPage();
  await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  assert.equal(await page.$(".zoomhint-box"), null, "animated mouse hint hidden on a touch device");
  const cap = await page.textContent(".chart-zoombar");
  assert.match(cap, /swipe/i, "zoom caption speaks touch");
  const box = await page.evaluate(() => { const el = document.querySelector(".recharts-wrapper"); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const cdp = await ctx.newCDPSession(page);
  const y = box.y + box.h * 0.5;
  const x0 = box.x + box.w * 0.35, x1 = box.x + box.w * 0.75;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / 8, y }] }); await page.waitForTimeout(30); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  assert.ok(await page.$("button.pill"), "Reset-zoom button appears after a sideways swipe");
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
