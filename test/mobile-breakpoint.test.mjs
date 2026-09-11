import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

test("phones hide the bar icon group so the ☰ toggle always fits", () => {
  assert.ok(css.includes(".tzone .tbar .tsocial{ display:none; }"), "React nav");
  assert.ok(landing.includes(".bar .social{ display:none; }"), "landing nav");
  assert.ok(landing.includes("html, body{ overflow-x:clip; }"), "landing never scrolls sideways");
});
