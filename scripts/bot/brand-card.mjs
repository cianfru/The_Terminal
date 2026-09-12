// The site's social share card — the image a link to spx6900rainbow.xyz unfurls with.
//
// Deliberately NOT a chart. The root link used to preview as the rainbow chart, which sold the
// site as one chart; it is a whole analytics desk now, so the card is plain identity: the arc
// mark, the wordmark, one line saying what the site is. Per-chart deep links still unfurl with
// their own chart card (api/share.js → api/og) — that is where a specific chart belongs.
//
// Pure SVG (no rasterizer) so it can be unit-tested; scripts/build-og-brand.mjs rasterizes it to
// public/og-brand.png, which is what index.html points at. A STATIC file on purpose: link
// crawlers are impatient and cache hard, so a plain PNG beats a serverless render for the one
// image every share of the site root depends on.

// The brand palette, copied from the landing's :root tokens (public/landing-next.html).
export const BRAND = {
  bg: "#05060c",      // near-black ground, a touch lifted off the app's #020208 so the glow reads
  tx: "#eef2f8",      // --tx, the wordmark
  dim: "#aab6c6",     // --dim, nudged brighter: this is a thumbnail, contrast is the house rule
  live: "#37f7a0",    // --live, the terminal cursor
  // --b0…--b8, the rainbow band colours. Ordered purple → red, as the header hairline runs.
  bands: ["#5b2a86", "#3b49c9", "#1f8fe0", "#12c2c2", "#37d067", "#c7d21f", "#f0a915", "#f2621b", "#e5342f"],
};

const r = (n, p = 2) => Number(n.toFixed(p));
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The arc-sphere mark, in its own 100×100 space — the same nine paths the landing and the app
// header draw, so the card, the site and the favicon are one mark.
const ARCS = [
  ["M 38.01 10.79 Q 50 -1.16 61.99 10.79", "#e5342f"],
  ["M 26.34 16.52 Q 50 6.31 73.66 16.52", "#f2621b"],
  ["M 17.04 25.61 Q 50 18.18 82.96 25.61", "#f0a915"],
  ["M 11.06 37.16 Q 50 33.25 88.94 37.16", "#c7d21f"],
  ["M 9.00 50.00 Q 50 50.00 91.00 50.00", "#37d067"],
  ["M 11.06 62.84 Q 50 66.75 88.94 62.84", "#12c2c2"],
  ["M 17.04 74.39 Q 50 81.82 82.96 74.39", "#1f8fe0"],
  ["M 26.34 83.48 Q 50 93.69 73.66 83.48", "#3b49c9"],
  ["M 38.01 89.21 Q 50 101.16 61.99 89.21", "#5b2a86"],
];

export const markSvg = (x, y, size) =>
  `<g transform="translate(${r(x)} ${r(y)}) scale(${r(size / 100, 4)})">` +
  ARCS.map(([d, c]) => `<path d="${d}" stroke="${c}" stroke-width="3.3" stroke-linecap="round" fill="none"/>`).join("") +
  `</g>`;

// Geist Mono is monospaced at exactly 0.6em per glyph and 0.71em cap height (measured off the
// instanced TTFs in tools/fonts). Monospace means text width is arithmetic, not a guess — which
// is the whole reason the lockup can be centred exactly without a text-measuring pass.
export const ADV = 0.6;
const CAP = 0.71;
export const textW = (str, size, tracking = 0) => str.length * size * ADV + Math.max(0, str.length - 1) * tracking;

export const WORDMARK = "SPX6900/Rainbow";
export const TAGLINE = "Independent analytics for SPX6900";

/**
 * The share card. Defaults to 1200×630, the size every crawler expects for a large summary card.
 * Lockup = mark + wordmark side by side (the site header, enlarged), tagline centred beneath.
 */
export function brandCardSvg({ W = 1200, H = 630, wordmark = WORDMARK, tagline = TAGLINE } = {}) {
  const FS = 68;                       // wordmark
  const MARK = Math.round(FS * 2.05);  // ~the header's mark:text ratio (34px mark, 18px text), a shade bigger
  const GAP = Math.round(FS * 0.46);
  const CUR = "_";

  const wordW = textW(wordmark, FS);
  const curW = textW(CUR, FS);
  const lockW = MARK + GAP + wordW + curW;
  const x0 = (W - lockW) / 2;
  const midY = H * 0.47;               // lockup centre: the tagline hangs below, so the ink sits optically centred
  const baseline = midY + (FS * CAP) / 2;
  const wordX = x0 + MARK + GAP;

  const TFS = 28;                      // tagline: the house micro-label — uppercase, tracked, mono
  const TRACK = TFS * 0.17;
  const tag = tagline.toUpperCase();
  const tagX = (W - textW(tag, TFS, TRACK)) / 2;
  const tagY = midY + 124;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bghair" x1="0" y1="0" x2="1" y2="0">
      ${BRAND.bands.map((c, i) => `<stop offset="${r(i / (BRAND.bands.length - 1) * 100, 2)}%" stop-color="${c}"/>`).join("")}
    </linearGradient>
    <radialGradient id="bgglow" cx="50%" cy="47%" r="62%">
      <stop offset="0%" stop-color="#1b2740" stop-opacity="0.75"/>
      <stop offset="55%" stop-color="#0a0e18" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${BRAND.bg}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BRAND.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#bgglow)"/>
  <rect width="${W}" height="5" fill="url(#bghair)"/>
  ${markSvg(x0, midY - MARK / 2, MARK)}
  <text x="${r(wordX)}" y="${r(baseline)}" font-family="Geist Mono" font-size="${FS}" font-weight="700" fill="${BRAND.tx}" letter-spacing="0">${esc(wordmark)}</text>
  <text x="${r(wordX + wordW)}" y="${r(baseline)}" font-family="Geist Mono" font-size="${FS}" font-weight="700" fill="${BRAND.live}">${CUR}</text>
  <text x="${r(tagX)}" y="${r(tagY)}" font-family="Geist Mono" font-size="${TFS}" font-weight="400" fill="${BRAND.dim}" letter-spacing="${r(TRACK)}">${esc(tag)}</text>
</svg>`;
}
