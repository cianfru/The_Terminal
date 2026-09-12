// The social share card is the one image every share of the site root shows, and it is rendered
// AHEAD of time (committed PNG), so nothing at request time can catch a mistake. These pin the
// parts that would silently produce a broken or off-brand card.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brandCardSvg, textW, ADV, WORDMARK, TAGLINE, BRAND } from "../scripts/bot/brand-card.mjs";

test("renders a 1200x630 card carrying the wordmark, the tagline and the nine-arc mark", () => {
  const svg = brandCardSvg();
  assert.match(svg, /width="1200" height="630"/);
  assert.ok(svg.includes(WORDMARK), "wordmark present");
  assert.ok(svg.includes(TAGLINE.toUpperCase()), "tagline present (the card sets it uppercase)");
  assert.equal((svg.match(/<path d="M /g) || []).length, 9, "all nine brand arcs");
  for (const c of BRAND.bands) assert.ok(svg.includes(c), `band colour ${c} present`);
});

test("the lockup and the tagline stay inside the canvas, and are centred", () => {
  const W = 1200;
  const svg = brandCardSvg({ W });
  // The mark's translate is the lockup's left edge; the cursor's x its right-most text start.
  const markX = Number(/translate\(([\d.]+) /.exec(svg)[1]);
  const texts = [...svg.matchAll(/<text x="([\d.]+)"[^>]*font-size="(\d+)"[^>]*letter-spacing="?([\d.]*)"?[^>]*>([^<]*)</g)]
    .map(m => ({ x: +m[1], size: +m[2], track: +(m[3] || 0), s: m[4] }));
  assert.ok(markX > 0, "lockup starts inside the canvas");
  for (const t of texts) {
    assert.ok(t.x >= 0, `${t.s} starts inside the canvas`);
    assert.ok(t.x + textW(t.s, t.size, t.track) <= W, `${t.s} ends inside the canvas`);
  }
  const tag = texts.find(t => t.s === TAGLINE.toUpperCase());
  // centred: left margin == right margin, to within a rounding pixel
  assert.ok(Math.abs(tag.x - (W - (tag.x + textW(tag.s, tag.size, tag.track)))) < 1.5, "tagline centred");
});

test("a longer wordmark still fits — the lockup is measured, not hard-coded", () => {
  const svg = brandCardSvg({ wordmark: "SPX6900/Rainbow-XL" });
  const markX = Number(/translate\(([\d.]+) /.exec(svg)[1]);
  assert.ok(markX > 0 && markX < 1200 / 2, "wider lockup shifts left but stays on the card");
});

test("escapes text so a stray < or & cannot break the SVG", () => {
  const svg = brandCardSvg({ wordmark: "a&b", tagline: "x<y" });
  assert.ok(svg.includes("a&amp;b"), "ampersand escaped in the wordmark");
  assert.ok(svg.includes("X&lt;Y"), "angle bracket escaped in the tagline (which renders uppercase)");
  assert.ok(!/X<Y/.test(svg), "no raw angle bracket reaches the markup");
});

test("Geist Mono is monospaced at 0.6em — the assumption every x-position rests on", () => {
  assert.equal(ADV, 0.6);
  assert.equal(textW("abcd", 10), 24);
  assert.equal(textW("abcd", 10, 2), 30);   // 3 gaps of tracking
});

test("the committed PNG the meta tags point at exists and is a 1200x630 PNG", () => {
  const buf = readFileSync(new URL("../public/og-brand.png", import.meta.url));
  assert.equal(buf.subarray(1, 4).toString(), "PNG");
  // IHDR: width and height are the two big-endian u32 right after the chunk type at byte 16
  assert.equal(buf.readUInt32BE(16), 1200);
  assert.equal(buf.readUInt32BE(20), 630);
});

test("index.html and the share route point at that PNG, not at a chart render", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const share = readFileSync(new URL("../api/share.js", import.meta.url), "utf8");
  assert.match(html, /property="og:image" content="https:\/\/spx6900rainbow\.xyz\/og-brand\.png"/);
  assert.match(html, /name="twitter:image" content="https:\/\/spx6900rainbow\.xyz\/og-brand\.png"/);
  assert.match(share, /img: `\$\{SITE\}\/og-brand\.png`/);
});
