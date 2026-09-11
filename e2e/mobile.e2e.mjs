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

// ── Accessibility ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
const AXE = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");

for (const theme of ["dark", "light"]) {
  test(`390px ${theme}: no WCAG A/AA violations axe can detect`, async () => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true, colorScheme: theme });
    for (const route of ["/?chart=hodlwaves", "/?view=charts"]) {
      const page = await ctx.newPage();
      if (theme === "light") await page.addInitScript(() => { try { localStorage.setItem("spx_theme", "bright"); } catch { /* private */ } });
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      if (theme === "light") await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
      await page.waitForTimeout(1500);
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
        return { violations: r.violations.map(x => `${x.id}(${x.nodes.length})`), passes: r.passes.length };
      });
      assert.ok(v.passes > 5, `axe actually ran on ${route} (${v.passes} rule sets passed)`);
      assert.deepEqual(v.violations, [], `${theme} ${route}`);
      await page.close();
    }
    await ctx.close();
  });
}

test("390px bright theme: chart prose and readouts clear AA, including SVG axis text", async () => {
  // axe skips SVG text entirely, and the bright theme is where the vivid accents fail: the manual
  // alone had 61 nodes at ~1.4:1 before the accent tokens landed.
  const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true, colorScheme: "light" });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("spx_theme", "bright"); } catch { /* private */ } });
  await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForTimeout(1800);
  const fails = await page.evaluate(() => {
    const lum = c => { const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; };
    const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const bgOf = el => { let n = el; while (n && n !== document.documentElement) { const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== "none") return null;      // gradient: unknowable
        const c = parse(cs.backgroundColor); if (c && c.a > 0.95) return c.rgb; n = n.parentElement; }
      const c = parse(getComputedStyle(document.body).backgroundColor); return c ? c.rgb : [255, 255, 255]; };
    const out = [];
    const check = (el, colorStr) => {
      if (el.closest('[aria-hidden="true"]')) return;                              // decorative
      const txt = (el.textContent || "").trim(); if (!txt) return;
      if (/^[\p{Extended_Pictographic}\p{So}\s]+$/u.test(txt)) return;              // an emoji is an image
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0") return;
      if (cs.webkitTextFillColor === "rgba(0, 0, 0, 0)") return;                   // gradient-clipped
      const fg = parse(colorStr); if (!fg || fg.a === 0) return;
      const bg = bgOf(el); if (!bg) return;
      const px = parseFloat(cs.fontSize) || 16, bold = (parseInt(cs.fontWeight) || 400) >= 700;
      const need = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;
      const cr = ratio(fg.a >= 1 ? fg.rgb : fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a)), bg);
      if (cr < need) out.push(`${txt.slice(0, 24)} ${cr.toFixed(2)}:1 needs ${need}`);
    };
    for (const el of document.querySelectorAll("body *")) if (!el.children.length) check(el, getComputedStyle(el).color);
    for (const t of document.querySelectorAll("svg text, svg tspan")) check(t, getComputedStyle(t).fill);
    return [...new Set(out)];
  });
  assert.deepEqual(fails, [], "every readable string clears AA on the bright theme");
  await ctx.close();
});

test("390px: reduced motion stops the animations, it does not merely slow them", async () => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true, colorScheme: "dark", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const probe = () => [...new Set([...document.querySelectorAll("*")]
    .map(el => getComputedStyle(el))
    .filter(s => s.animationName && s.animationName !== "none" && s.animationPlayState === "running"
      && (s.animationIterationCount === "infinite" || (parseFloat(s.animationDuration) || 0) > 0.4))
    .map(s => `${s.animationName} ${s.animationIterationCount}`))];
  const top = await page.evaluate(probe);
  const fr = page.frames().find(f => f.url().includes("landing-next"));
  const inner = fr ? await fr.evaluate(probe) : [];
  assert.deepEqual([...top, ...inner], [], "the ticker, cursors and scroll cue all stop");
  await ctx.close();
});

test("390px: every control shows a visible focus change", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/?view=charts", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const bad = await page.evaluate(async () => {
    const tick = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sig = el => { const s = getComputedStyle(el); return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join("|"); };
    // some controls render the ring on a wrapper, which is fine — compare the element and its ancestors
    const sigUp = el => { let n = el, o = []; for (let i = 0; i < 3 && n; i++) { o.push(sig(n)); n = n.parentElement; } return o.join("#"); };
    const els = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
    const out = [];
    for (const el of els) {
      const before = sigUp(el); el.focus(); await tick();
      if (sigUp(el) === before) out.push(`${el.tagName}.${String(el.className || "").split(" ")[0]}`);
      el.blur(); await tick();
    }
    return [...new Set(out)];
  });
  assert.deepEqual(bad, [], "no control focuses invisibly");
  await ctx.close();
});

test("390px: Explore traps focus, closes on Escape, and hands focus back", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/?view=charts", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector(".tmobtog").focus());
  await page.click(".tmobtog");
  await page.waitForTimeout(500);
  const inside = await page.evaluate(() => !!document.querySelector(".tsb.open")?.contains(document.activeElement));
  assert.ok(inside, "focus moves into the sheet on open");
  // Tab all the way round: focus must never leave the dialog
  for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
  assert.ok(await page.evaluate(() => !!document.querySelector(".tsb.open")?.contains(document.activeElement)),
    "Tab stays inside the dialog");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => !!document.querySelector(".tsb.open")), false, "Escape closes it");
  assert.equal(await page.evaluate(() => document.activeElement?.className), "tmobtog", "focus returns to the opener");
  await ctx.close();
});

// ── The five usability tasks, as far as a machine can check them ─────────────────────────────
// These prove each task is COMPLETABLE on a phone and count the taps. They cannot tell you whether
// anyone understands what they are looking at — that is what docs/mobile-usability-test.md is for.
test("390px: the five core tasks are completable, and cheap in taps", async () => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true });
  const page = await ctx.newPage();
  let taps = 0;
  const tap = async sel => { await page.tap(sel); taps++; await page.waitForTimeout(450); };

  // 1 — understand the offer: the landing states what the site is, without scrolling
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const fr = page.frames().find(f => f.url().includes("landing-next"));
  const pitch = await fr.evaluate(() => {
    const t = document.body.innerText.slice(0, 600).toLowerCase();
    return { says: /valuation|on-chain|holder/.test(t), hasCta: !!document.querySelector("#slideCharts, #ctaChart") };
  });
  assert.ok(pitch.says, "the first screen says what the site is about");
  assert.ok(pitch.hasCta, "and offers a way in");

  // 2 — find a valuation chart, via Explore search
  await page.goto(BASE + "/?view=charts", { waitUntil: "networkidle" });
  await tap(".tmobtog");
  await page.fill(".tsbsearchin", "valuation");
  await page.waitForTimeout(500);
  const hit = await page.$(".tsbrowmain");
  assert.ok(hit, "search finds a valuation chart");
  await hit.tap(); taps++;
  await page.waitForTimeout(2500);

  // 3 — read the latest value and what it means
  const insight = await page.evaluate(() => {
    const el = document.querySelector(".chart-insight");
    return el ? { v: el.querySelector(".chart-insight-v")?.textContent || "", m: el.querySelector(".chart-insight-m")?.textContent || "" } : null;
  });
  assert.ok(insight && /\d/.test(insight.v), "a current value is stated");
  assert.ok(insight.m.length > 20, "and what it means, in words");

  // 4 — zoom into a period. On touch the supported path is Fullscreen + pinch (see the test above:
  // a horizontal drag on the plot belongs to the pager, so a swipe-to-zoom would teach a gesture
  // that fights it). This follows the path the caption actually tells the user to take.
  const cap = await page.textContent(".chart-zoombar");
  assert.match(cap, /fullscreen/i, "the chart tells a touch user how to zoom");
  const fsBtn = (await page.$$(".tchart button")).length
    ? await page.evaluateHandle(() => [...document.querySelectorAll(".tchart button")]
        .find(b => /full-screen/i.test(b.getAttribute("title") || "")))
    : null;
  assert.ok(fsBtn && (await fsBtn.asElement()), "a fullscreen control is offered on a phone");
  await fsBtn.asElement().click(); taps++;
  await page.waitForTimeout(800);
  const fsOpen = await page.evaluate(() => !!document.querySelector(".fsview"));
  assert.ok(fsOpen, "the fullscreen viewer opens");
  // Held PORTRAIT it deliberately asks you to rotate rather than pinching a letterbox — the plot
  // body is only mounted in landscape, so that hint is the honest state, not a failure.
  assert.ok(await page.$(".fsview.fsportrait, .fsrotate"), "portrait asks the reader to rotate");
  // The pinch itself is exercised in landscape by the test below; held portrait the viewer
  // deliberately mounts no plot, so there is nothing to pinch yet.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // 5 — save another chart and find it again
  await tap(".tmobtog");
  await page.fill(".tsbsearchin", "hodl");
  await page.waitForTimeout(500);
  await tap(".tsbstar");
  await page.fill(".tsbsearchin", "");
  await page.waitForTimeout(600);
  const rails = await page.$$eval(".tsbrailh", els => els.map(e => e.textContent));
  assert.ok(rails.some(r => /Saved/i.test(r)), "the saved chart is waiting on the Saved rail");
  assert.ok(taps <= 12, `the whole run costs few taps (${taps})`);
  await ctx.close();
});

test("landscape: the fullscreen viewer mounts the plot and pinch zooms it", async () => {
  // The touch zoom path the chart caption points at. Portrait shows a rotate hint instead, so this
  // runs in a landscape viewport — the orientation the viewer is designed for.
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/?chart=hodlwaves", { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const fs = await page.evaluateHandle(() => [...document.querySelectorAll(".tchart button")]
    .find(b => /full-screen/i.test(b.getAttribute("title") || "")));
  assert.ok(fs.asElement(), "fullscreen is offered");
  await fs.asElement().click();
  await page.waitForTimeout(900);
  assert.ok(await page.$(".fsview"), "the viewer opens");
  assert.ok(await page.$(".fsbody"), "landscape mounts the chart body");
  const cdp = await ctx.newCDPSession(page);
  const cx = 422, cy = 195, pts = d => [{ x: cx - d, y: cy }, { x: cx + d, y: cy }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(40) });
  for (const d of [70, 100, 130, 160]) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(d) }); await page.waitForTimeout(60); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
  const scale = await page.evaluate(() => {
    const el = document.querySelector(".fsbody")?.firstElementChild;
    const m = el ? getComputedStyle(el).transform.match(/matrix\(([^,]+)/) : null;
    return m ? parseFloat(m[1]) : 1;
  });
  assert.ok(scale > 1.05, `two fingers zoom the plot (scale ${scale})`);
  await ctx.close();
});
