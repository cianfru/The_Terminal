// The site's social share card — the image a link to spx6900rainbow.xyz unfurls with.
//
// Deliberately NOT a chart. The root link used to preview as the rainbow chart, which sold a whole
// analytics desk as one chart. Per-chart deep links still unfurl with their own chart card
// (api/share.js → api/og) — that is where a specific chart belongs.
//
// The lockup is the owner's own artwork (public/brand-lockup.png): the tilted arc sphere and the
// pixel wordmark. It is PLACED, never redrawn — so the card cannot drift from the brand. The only
// type this file sets is the line underneath, in the landing's pixel face so it belongs to the
// same lockup.
//
// Pure SVG (no rasterizer, no disk reads) so it can be unit-tested; scripts/build-og-brand.mjs
// passes in the artwork and rasterizes the result to the committed public/og-brand.png, which is
// what index.html points at. A STATIC file on purpose: link crawlers are impatient and cache hard,
// so nothing about the site's own preview should depend on a function being warm.

const r = (n, p = 2) => Number(n.toFixed(p));
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The artwork is opaque black, so the card's ground is black too — anything else would show the
// artwork's own rectangle.
export const BG = "#000000";
export const DIM = "#a2adbe";        // the landing's --dim: the line reads quietly under the wordmark

export const TAGLINE = "Independent analytics for SPX6900";

// Px437 IBM VGA 8x16 (public/fonts/PxVGA.ttf), the landing's pixel face — the one in the wordmark.
// A bitmap face is only crisp at whole-pixel sizes: its cell is 16 units of em, so the font size
// must be a MULTIPLE OF 16 or every stem lands on a fraction of a device pixel and goes soft.
export const PIXEL_FAMILY = "Px437 IBM VGA 8x16";
const PIXEL_ADV = 0.5;               // monospaced: 8 of the 16 units per cell
export const pixelTextW = (s, size, tracking = 0) => s.length * size * PIXEL_ADV + Math.max(0, s.length - 1) * tracking;

/**
 * The share card, 1200×630 (the size every crawler expects for a large summary card).
 *
 * @param {object}  o
 * @param {string}  o.lockup    the artwork as a data: URI — resvg does NOT resolve remote hrefs
 * @param {number} [o.lockupAR] artwork aspect ratio (w/h), so it is placed without distortion
 */
export function brandCardSvg({ W = 1200, H = 630, lockup = "", lockupAR = 1964 / 459, tagline = TAGLINE } = {}) {
  const lw = Math.round(W * 0.845);          // ~95px of air either side
  const lh = Math.round(lw / lockupAR);
  const lx = (W - lw) / 2;
  const ly = Math.round(H * 0.43 - lh / 2);  // the block rides a little high; the line balances it

  const TFS = 32;                            // 2 device pixels per font pixel — see PIXEL_FAMILY
  const TRACK = 2;
  const tag = tagline.toUpperCase();
  const tagX = (W - pixelTextW(tag, TFS, TRACK)) / 2;
  const tagY = ly + lh + 84;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <image x="${r(lx)}" y="${r(ly)}" width="${lw}" height="${lh}" href="${lockup}"/>
  <text x="${r(tagX)}" y="${r(tagY)}" font-family="${PIXEL_FAMILY}" font-size="${TFS}" letter-spacing="${TRACK}" fill="${DIM}">${esc(tag)}</text>
</svg>`;
}
