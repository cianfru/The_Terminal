import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// ONE mobile breakpoint. JS (src/viewport.js) is the source of truth; the CSS in terminal.css and the
// landing page cannot import it, so this test pins them to the same number. Before this, the React
// isMobile flag switched at 640px, the React nav's hamburger at 760px and the landing's menu at 700px —
// a 640–760px viewport got the phone menu with desktop chart layouts.
const src = readFileSync(new URL("../src/viewport.js", import.meta.url), "utf8");
const BP = Number(src.match(/export const MOBILE_BP = (\d+);/)[1]);
const css = readFileSync(new URL("../src/terminal.css", import.meta.url), "utf8");
const landing = readFileSync(new URL("../public/landing-next.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const track = readFileSync(new URL("../src/track.js", import.meta.url), "utf8");

test("MOBILE_BP is a sane phone/tablet split", () => {
  assert.ok(BP >= 600 && BP <= 900, `MOBILE_BP=${BP}`);
});

test("terminal.css hamburger switch uses MOBILE_BP", () => {
  const m = css.match(/@media\(max-width:(\d+)px\)\{\s*\n\s*\.tzone \.tmenu\{ display:none; \}/);
  assert.ok(m, "hamburger media block not found");
  assert.equal(Number(m[1]), BP);
});

test("landing menu, CTA swap and JS probe use MOBILE_BP", () => {
  assert.ok(landing.includes(`@media(max-width:${BP}px){\n    .menu{ display:none; }`), "landing mobile menu block");
  assert.ok(landing.includes(`@media(min-width:${BP + 1}px){ #ctaChart`), "landing CTA swap");
  assert.ok(landing.includes(`matchMedia('(max-width:${BP}px)')`), "landing __sbMobile probe");
  assert.ok(!/max-width:700px|min-width:701px/.test(landing), "stale 700px mode breakpoint left in landing");
});

test("App.jsx and track.js read the shared constant, not a literal", () => {
  assert.ok(app.includes("useMedia(MOBILE_MQ)"), "App isMobile via matchMedia");
  assert.ok(!/isMobile = vw < \d+/.test(app), "App still compares innerWidth to a literal");
  assert.ok(track.includes("isMobileWidth()"), "track.js device class");
});

test("phones keep only brand + one account chip + one ☰ Explore in the bar", () => {
  // secondary icons (theme, X, Kraken) move to the springboard dock; the account chip stays
  assert.ok(css.includes(".tzone .tbar .tsocial-ext, .tzone .tbar .tthemebtn{ display:none; }"), "React nav sheds secondary icons");
  assert.ok(landing.includes(".bar .social .siclink:not(.dfauth){ display:none; }"), "landing sheds secondary icons");
  assert.ok(landing.includes("html, body{ overflow-x:clip; }"), "landing never scrolls sideways");
});

test("every bar control is a ≥44px tap target", () => {
  assert.match(css, /\.tzone \.tbar \.siclink\{ width:44px; height:44px; \}/, "React account chip");
  assert.match(css, /\.tzone \.tmobtog\{[^}]*width:44px; height:44px;/, "React ☰");
  assert.match(landing, /\.mobtog\{[^}]*width:44px; height:44px;/, "landing ☰");
  assert.match(landing, /\.bar \.social \.siclink\.dfauth\{ width:44px; height:44px; \}/, "landing account chip");
});

test("the landing CTA opens on a plain tap, and says so", () => {
  // the pointer script already fired open() on click; the LABEL demanded a slide, which is the
  // barrier on a phone. Slide stays as optional feedback.
  assert.ok(landing.includes("tap to open charts"), "CTA label is tap-first");
  assert.match(landing, /cta\.addEventListener\('click',\(\)=>\{ if\(moved<6\) open\(\); \}\);/, "whole control is tappable");
});

test("fullscreen is available on phones, and the shell under the landing iframe is inert", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.ok(!/\{!isMobile && <MenuBtn onClick=\{\(\) => setFsOpen\(true\)\}/.test(app), "chart fullscreen no longer desktop-only");
  assert.ok(!/\{!isMobile && <MenuBtn className="cityfsbtn"/.test(app), "city fullscreen no longer desktop-only");
  assert.ok(app.includes("const landingCovers ="), "landingCovers computed");
  assert.ok(app.includes("inert={landingCovers || undefined}"), "covered nav is inert (React 19 needs a BOOLEAN; inert=\"\" reads as false)");
});

test("drag-to-zoom stays mouse-only (the chart surface's horizontal flick belongs to the pager)", () => {
  // App.jsx binds a horizontal flick on .tchart to prev/next chart. If a chart also wired the drag
  // handlers to touch, one swipe would flip the chart AND draw a zoom selection.
  const charts = readdirSync(new URL("../src", import.meta.url)).filter(f => f.endsWith(".jsx"));
  const offenders = charts.filter(f => /onTouch(Start|Move|End)=\{on(Down|Move|Up)\}/
    .test(readFileSync(new URL("../src/" + f, import.meta.url), "utf8")));
  assert.deepEqual(offenders, [], "no chart wires drag-to-zoom to touch");
  const ui = readFileSync(new URL("../src/chart-ui.jsx", import.meta.url), "utf8");
  // The fullscreen viewer it used to route to is gone (iOS Safari never granted it fullscreen), so
  // the caption points at the browser's own pinch, which always worked.
  assert.match(ui, /coarse \? "Pinch to zoom/, "touch caption routes to the native pinch");
});
