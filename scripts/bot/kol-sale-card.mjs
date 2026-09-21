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
import { brandStripe } from "./chrome.mjs";

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
    heldNow, soldPct, W = 1600, H = 900, fetchImpl = fetch,
  } = opts;

  const art = artUrl ? await fetchArtDataUri(artUrl, { fetchImpl }) : null;
  const mL = 104, mR = 268, mT = 178, mB = 104, PW = W - mL - mR, PH = H - mT - mB;
  const t0 = Date.parse(prices[0].date), t1 = Date.parse(prices.at(-1).date);
  const vals = prices.map(p => p.price);
  const lo = Math.min(...vals) * 0.85, hi = Math.max(...vals) * 1.15;
  const X = t => mL + (t - t0) / (t1 - t0) * PW;
  const Y = p => mT + PH - (Math.log10(Math.max(p, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * PH;

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#070910"/>${brandStripe(H)}
<text x="${mL}" y="70" font-family="sans-serif" font-size="38" font-weight="800" fill="#f1f5f9">The wallet behind AEON #${token} just sold ${esc(fmt(event.qty))} SPX</text>
<text x="${mL}" y="112" font-family="sans-serif" font-size="23" fill="#94a3b8">Every buy and sell this household has ever made. It has sold ${esc(String(soldPct))}% of what it bought.</text>
<text x="${mL}" y="146" font-family="sans-serif" font-size="20" fill="#64748b">AEON #${token} is rank ${esc(String(rank))} of 3,333. Cluster traced from the profile picture; the transaction hash is on the card.</text>`;

  for (const v of logTicks(lo, hi)) s += `<line x1="${mL}" y1="${r2(Y(v))}" x2="${mL + PW}" y2="${r2(Y(v))}" stroke="#ffffff" stroke-opacity="0.06"/>`
    + `<text x="${mL - 14}" y="${r2(Y(v) + 7)}" text-anchor="end" font-family="sans-serif" font-size="21" fill="#94a3b8">$${v < 1 ? v.toFixed(v < 0.01 ? 3 : 2) : v.toFixed(0)}</text>`;
  for (let y = new Date(t0).getUTCFullYear() + 1; y <= new Date(t1).getUTCFullYear(); y++) {
    const x = X(Date.parse(`${y}-01-01`));
    s += `<line x1="${r2(x)}" y1="${mT}" x2="${r2(x)}" y2="${mT + PH}" stroke="#ffffff" stroke-opacity="0.10"/>`
       + `<text x="${r2(x)}" y="${mT + PH + 38}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#94a3b8">${y}</text>`;
  }
  s += `<polyline points="${prices.map(p => `${r2(X(Date.parse(p.date)))},${r2(Y(p.price))}`).join(" ")}" fill="none" stroke="#f8fafc" stroke-width="2.4" opacity="0.9"/>`;

  const mx = Math.max(...trades.map(t => t.qty), event.qty);
  const R = q => 7 + 19 * Math.sqrt(q / mx);
  for (const t of trades) {
    if (t.tx === event.tx) continue;
    const c = t.kind === "buy" ? ["#22c55e", "#4ade80"] : ["#f43f5e", "#fb7185"];
    s += `<circle cx="${r2(X(Date.parse(t.ts)))}" cy="${r2(Y(t.price))}" r="${r2(R(t.qty))}" fill="${c[0]}" fill-opacity="0.20" stroke="${c[1]}" stroke-width="2.2"/>`;
  }
  // the new sale: ringed so it reads instantly against three years of history
  const ex = X(Date.parse(event.ts)), ey = Y(event.price);
  s += `<circle cx="${r2(ex)}" cy="${r2(ey)}" r="${r2(R(event.qty) + 14)}" fill="none" stroke="#fb7185" stroke-width="2.6" opacity="0.65"/>`
     + `<circle cx="${r2(ex)}" cy="${r2(ey)}" r="${r2(R(event.qty))}" fill="#f43f5e" fill-opacity="0.45" stroke="#fecdd3" stroke-width="3"/>`
  // a fresh sale sits at the RIGHT edge, where the label would run into the artwork —
  // so anchor it inward once the dot is late in the window.
  const late = ex > mL + PW * 0.75;
  s += `<text x="${r2(late ? ex - R(event.qty) - 16 : ex)}" y="${r2(ey - R(event.qty) - 26)}" text-anchor="${late ? "end" : "middle"}" font-family="sans-serif" font-size="25" font-weight="800" fill="#fecdd3">${esc(fmt(event.qty))} SPX</text>`;

  // the piece itself, at the end of the line — so it is unmistakably this household.
  // AEON renders are 1200x1636 PORTRAIT with the face high in the frame, so a centred
  // "slice" crop lands on the top of the head. Scale to the circle's width and offset so
  // the FACE sits on the centre line.
  const ax = mL + PW + 104, ay = Y(prices.at(-1).price), AR = 62;
  const artW = AR * 2, artH = artW * (1636 / 1200), FACE = 0.46;
  s += `<defs><clipPath id="pfp"><circle cx="${r2(ax)}" cy="${r2(ay)}" r="${AR}"/></clipPath></defs>`;
  if (art) s += `<image href="${art}" x="${r2(ax - AR)}" y="${r2(ay - artH * FACE)}" width="${r2(artW)}" height="${r2(artH)}" clip-path="url(#pfp)"/>`;
  else s += `<circle cx="${r2(ax)}" cy="${r2(ay)}" r="${AR}" fill="#1e293b"/><text x="${r2(ax)}" y="${r2(ay + 9)}" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="800" fill="#94a3b8">#${token}</text>`;
  s += `<circle cx="${r2(ax)}" cy="${r2(ay)}" r="${AR + 2}" fill="none" stroke="#fb7185" stroke-width="3"/>`
     + `<line x1="${r2(mL + PW)}" y1="${r2(ay)}" x2="${r2(ax - AR - 4)}" y2="${r2(ay)}" stroke="#fb7185" stroke-width="2" opacity="0.5"/>`;

  const legend = [["#4ade80", `bought ${fmt(trades.filter(t => t.kind === "buy").reduce((a, t) => a + t.qty, 0))} SPX`],
                  ["#fb7185", `sold ${fmt(trades.filter(t => t.kind === "sell").reduce((a, t) => a + t.qty, 0))} SPX`],
                  ["#94a3b8", `holds ${fmt(heldNow)} SPX today`]];
  legend.forEach(([c, label], i) => {
    const y = H - 44 - (legend.length - 1 - i) * 0;
    s += `<circle cx="${mL + 12 + i * 400}" cy="${y - 7}" r="8" fill="${c}"/>`
       + `<text x="${mL + 30 + i * 400}" y="${y}" font-family="sans-serif" font-size="22" fill="#cbd5e1">${esc(label)}</text>`;
  });
  s += `<text x="${W - 40}" y="${H - 44}" text-anchor="end" font-family="sans-serif" font-size="20" fill="#64748b">spx6900rainbow.xyz</text></svg>`;
  return new Resvg(s, { fitTo: { mode: "width", value: W }, font: FONT }).render().asPng();
}
