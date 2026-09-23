// The social share card is the one image every share of the site root shows, and it is rendered
// AHEAD of time (committed PNG), so nothing at request time can catch a mistake. These pin the
// parts that would silently produce a broken card.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brandCardSvg, pixelTextW, TAGLINE, PIXEL_FAMILY, BG } from "../scripts/bot/brand-card.mjs";

const DATA_URI = "data:image/png;base64,AAAA";

test("renders a 1200x630 card: the lockup artwork on black, one line under it", () => {
  const svg = brandCardSvg({ lockup: DATA_URI });
  assert.match(svg, /width="1200" height="630"/);
  assert.ok(svg.includes(`href="${DATA_URI}"`), "the artwork is placed, not redrawn");
  assert.ok(svg.includes(TAGLINE.toUpperCase()), "tagline present (the card sets it uppercase)");
  assert.ok(svg.includes(`fill="${BG}"`), "black ground — the artwork's own rectangle is opaque black");
  assert.ok(svg.includes(PIXEL_FAMILY), "the line is set in the lockup's own pixel face");
});

test("resvg cannot fetch hrefs, so the artwork must arrive inlined", () => {
  const svg = brandCardSvg({ lockup: DATA_URI });
  const href = /<image[^>]*href="([^"]*)"/.exec(svg)[1];
  assert.ok(href.startsWith("data:image/"), `href must be a data: URI, got ${href.slice(0, 40)}`);
});

test("the artwork keeps its aspect ratio and stays inside the canvas with the line", () => {
  const W = 1200, H = 630, AR = 1964 / 459;
  const svg = brandCardSvg({ W, H, lockup: DATA_URI, lockupAR: AR });
  const m = /<image x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(svg);
  const [x, y, w, h] = m.slice(1).map(Number);
  assert.ok(Math.abs(w / h - AR) < 0.01, "placed at the artwork's own aspect ratio");
  assert.ok(x > 0 && x + w <= W, "artwork fits horizontally");
  assert.ok(y > 0 && y + h <= H, "artwork fits vertically");
  assert.ok(Math.abs(x - (W - (x + w))) < 1, "artwork centred");

  const t = /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="(\d+)" letter-spacing="(\d+)"[^>]*>([^<]*)</.exec(svg);
  const [tx, ty, size, track, str] = [Number(t[1]), Number(t[2]), Number(t[3]), Number(t[4]), t[5]];
  const tw = pixelTextW(str, size, track);
  assert.ok(tx > 0 && tx + tw <= W, "the line fits on the card");
  assert.ok(Math.abs(tx - (W - (tx + tw))) < 1, "the line is centred");
  assert.ok(ty > y + h, "the line sits below the artwork");
  assert.ok(ty <= H - 20, "the line is not clipped off the bottom");
});

test("the pixel face is set at a whole-pixel size, or every stem goes soft", () => {
  const size = Number(/font-size="(\d+)"/.exec(brandCardSvg({ lockup: DATA_URI }))[1]);
  assert.equal(size % 16, 0, "Px437's cell is 16 units of em — the size must be a multiple of 16");
});

test("escapes text so a stray < or & cannot break the SVG", () => {
  const svg = brandCardSvg({ lockup: DATA_URI, tagline: "a&b <c>" });
  assert.ok(svg.includes("A&amp;B &lt;C&gt;"), "ampersand and angle brackets escaped");
  assert.ok(!/>[^<]*<C>/.test(svg), "no raw angle bracket reaches the markup");
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
