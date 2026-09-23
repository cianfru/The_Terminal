// ============================================================================
// KOL SALE CARD — a tracked household just sold. Here is its whole record.
// ============================================================================
// Price line with every past buy (green) and sell (red) the cluster ever made, the new
// sale ringed, and the NFT that identifies the household at the right end of the line.
//
// ⚠ resvg does NOT resolve remote hrefs — <image href="https://…"> renders as NOTHING.
// The art must be embedded as a data URI. A failed fetch falls back to a plain marker,
// never a blank card and never a failed post.
// ============================================================================
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FONT } from "./font.mjs";
import { brandStripe, auraBg, cardDepth, plotPanel } from "./chrome.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r2 = n => Number(n.toFixed(2));
const fmt = (n, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });

/** The art, as a data URI. resvg cannot fetch, so this is not optional. */
export async function fetchArtDataUri(url, { fetchImpl = fetch } = {}) {
  try {
    const r = await fetchImpl(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return null;
    const type = r.headers.get("content-type") || "image/png";
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

/** Nice round ticks across a log price axis. */
export function logTicks(lo, hi) {
  const out = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(v); }
  return out;
}

export async function renderKolSaleCard(opts) {
  const {
    token, rank, artUrl, prices, trades, event, spot,
    W = 1200, H = 1200, fetchImpl = fetch,
  } = opts;

  const art = artUrl ? await fetchArtDataUri(artUrl, { fetchImpl }) : null;
  const GRN = "#22c55e", GRN2 = "#4ade80", ROSE = "#f43f5e", ROSE2 = "#fb7185";
  // 1:1. The extra vertical room goes to a stat strip, so the card carries the whole
  // record at a glance instead of making the reader count orbs.
  const mL = 108, mR = 244, mT = 252, mB = 340, PW = W - mL - mR, PH = H - mT - mB;
  const t0 = Date.parse(prices[0].date), t1 = Date.parse(prices.at(-1).date);
  const vals = prices.map(p => p.price);
  const lo = Math.min(...vals) * 0.85, hi = Math.max(...vals) * 1.15;
  const X = t => mL + (t - t0) / (t1 - t0) * PW;
  const Y = p => mT + PH - (Math.log10(Math.max(p, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * PH;

  // House ground, then a two-hue wash: rose from the top (this is a SELL) and green from
  // the lower-right so the buy history reads as its own colour rather than dead green dots.
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="kbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0b0b16"/><stop offset="100%" stop-color="#05050e"/></linearGradient>
<linearGradient id="kfill" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.40"/>
  <stop offset="60%" stop-color="#7dd3fc" stop-opacity="0.10"/>
  <stop offset="100%" stop-color="#7dd3fc" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#kbg)"/>
${auraBg(ROSE, W, H, { opacity: 0.28, accent2: GRN })}
${cardDepth(W, H)}${brandStripe(H)}
<text x="${mL}" y="86" font-family="sans-serif" font-size="42" font-weight="800" fill="#f1f5f9">The wallet behind AEON #${token}</text>
<text x="${mL}" y="140" font-family="sans-serif" font-size="42" font-weight="800" fill="${ROSE2}">just sold ${esc(fmt(event.qty))} SPX</text>
<text x="${mL}" y="186" font-family="sans-serif" font-size="24" fill="#94a3b8">Every buy and sell this household has ever made.</text>
<text x="${mL}" y="218" font-family="sans-serif" font-size="21" fill="#64748b">AEON #${token} \u2014 rank ${esc(String(rank))} of 3,333. Traced from the profile picture; the hash is below.</text>
${plotPanel(mL - 26, mT - 26, PW + 52, PH + 52)}`;

  for (const v of logTicks(lo, hi)) s += `<line x1="${mL}" y1="${r2(Y(v))}" x2="${mL + PW}" y2="${r2(Y(v))}" stroke="#ffffff" stroke-opacity="0.055"/>`
    + `<text x="${mL - 16}" y="${r2(Y(v) + 7)}" text-anchor="end" font-family="sans-serif" font-size="21" fill="#94a3b8">$${v < 1 ? v.toFixed(v < 0.01 ? 3 : 2) : v.toFixed(0)}</text>`;
  for (let y = new Date(t0).getUTCFullYear() + 1; y <= new Date(t1).getUTCFullYear(); y++) {
    const x = X(Date.parse(`${y}-01-01`));
    s += `<line x1="${r2(x)}" y1="${mT}" x2="${r2(x)}" y2="${mT + PH}" stroke="#ffffff" stroke-opacity="0.09"/>`
       + `<text x="${r2(x)}" y="${mT + PH + 40}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#94a3b8">${y}</text>`;
  }
  const pts = prices.map(p => `${r2(X(Date.parse(p.date)))},${r2(Y(p.price))}`);
  s += `<polygon points="${mL},${mT + PH} ${pts.join(" ")} ${mL + PW},${mT + PH}" fill="url(#kfill)"/>`
     + `<polyline points="${pts.join(" ")}" fill="none" stroke="#f8fafc" stroke-width="2.6" opacity="0.92"/>`;

  const mx = Math.max(...trades.map(t => t.qty), event.qty);
  const R = q => 8 + 22 * Math.sqrt(q / mx);
  for (const t of trades) {
    if (t.tx === event.tx) continue;
    const c = t.kind === "buy" ? [GRN, GRN2] : [ROSE, ROSE2];
    s += `<circle cx="${r2(X(Date.parse(t.ts)))}" cy="${r2(Y(t.price))}" r="${r2(R(t.qty))}" fill="${c[0]}" fill-opacity="0.24" stroke="${c[1]}" stroke-width="2.4"/>`;
  }
  const ex = X(Date.parse(event.ts)), ey = Y(event.price);
  s += `<circle cx="${r2(ex)}" cy="${r2(ey)}" r="${r2(R(event.qty) + 17)}" fill="none" stroke="${ROSE2}" stroke-width="2.8" opacity="0.6"/>`
     + `<circle cx="${r2(ex)}" cy="${r2(ey)}" r="${r2(R(event.qty))}" fill="${ROSE}" fill-opacity="0.5" stroke="#fecdd3" stroke-width="3.2"/>`;
  const late = ex > mL + PW * 0.72;
  s += `<text x="${r2(late ? ex - R(event.qty) - 18 : ex)}" y="${r2(ey - R(event.qty) - 28)}" text-anchor="${late ? "end" : "middle"}" font-family="sans-serif" font-size="26" font-weight="800" fill="#fecdd3">${esc(fmt(event.qty))} SPX</text>`;

  // the piece itself, at the end of the line. AEON renders are 1200x1636 PORTRAIT with the
  // face high in the frame, so a centred crop lands on the top of the head — offset so the
  // face sits on the centre line.
  const ax = mL + PW + 118, ay = Y(prices.at(-1).price), AR = 74;
  const artW = AR * 2, artH = artW * (1636 / 1200), FACE = 0.46;
  s += `<defs><clipPath id="pfp"><circle cx="${r2(ax)}" cy="${r2(ay)}" r="${AR}"/></clipPath></defs>`
     + `<circle cx="${r2(ax)}" cy="${r2(ay)}" r="${AR + 9}" fill="${ROSE}" fill-opacity="0.16"/>`;
  if (art) s += `<image href="${art}" x="${r2(ax - AR)}" y="${r2(ay - artH * FACE)}" width="${r2(artW)}" height="${r2(artH)}" clip-path="url(#pfp)"/>`;
  else s += `<circle cx="${r2(ax)}" cy="${r2(ay)}" r="${AR}" fill="#1e293b"/><text x="${r2(ax)}" y="${r2(ay + 10)}" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="800" fill="#94a3b8">#${token}</text>`;
  s += `<circle cx="${r2(ax)}" cy="${r2(ay)}" r="${AR + 2}" fill="none" stroke="${ROSE2}" stroke-width="3.4"/>`
     + `<line x1="${r2(mL + PW)}" y1="${r2(ay)}" x2="${r2(ax - AR - 12)}" y2="${r2(ay)}" stroke="${ROSE2}" stroke-width="2.2" opacity="0.5"/>`;

  // ⚠ NO AGGREGATE TOTALS. A "bought / sold / holds" strip invited a subtraction that does
  // not close — 1,092,500 bought minus 836,673 sold is 255,827, but the household holds
  // 410,623, because 421,602 arrived and 266,806 left by plain TRANSFER. The arithmetic is
  // right and the card still read as broken. A tweet card cannot carry six legs of a ledger,
  // so it carries none: the event, the picture, and the hash that proves it.
  const sy = mT + PH + 150;
  const key = (x, colour, label) =>
      `<circle cx="${x + 11}" cy="${sy - 9}" r="11" fill="${colour}" fill-opacity="0.28" stroke="${colour}" stroke-width="2.6"/>`
    + `<text x="${x + 32}" y="${sy}" font-family="sans-serif" font-size="25" fill="#cbd5e1">${esc(label)}</text>`;
  s += `<line x1="${mL}" y1="${sy - 52}" x2="${mL + PW + 52}" y2="${sy - 52}" stroke="#ffffff" stroke-opacity="0.10"/>`
     + key(mL, GRN2, "every buy") + key(mL + 240, ROSE2, "every sell")
     + `<text x="${mL + 520}" y="${sy}" font-family="sans-serif" font-size="25" fill="#94a3b8">since October 2023</text>`
     + `<text x="${mL}" y="${sy + 60}" font-family="sans-serif" font-size="22" fill="#64748b">THIS SALE</text>`
     + `<text x="${mL}" y="${sy + 100}" font-family="sans-serif" font-size="25" font-weight="700" fill="#e2e8f0">${esc(event.ts.slice(0, 10))} \u00b7 ${esc(fmt(event.qty))} SPX</text>`
     ;
  // the receipt, on the card itself — the hash is the point, so it should not live only in the tweet
  s += `<text x="${mL}" y="${sy + 140}" font-family="sans-serif" font-size="19" fill="#64748b">${esc(event.tx)}</text>`
     + `<text x="${W - 56}" y="${sy + 140}" text-anchor="end" font-family="sans-serif" font-size="21" fill="#64748b">spx6900rainbow.xyz</text></svg>`;
  return new Resvg(s, { fitTo: { mode: "width", value: W }, font: FONT }).render().asPng();
}
