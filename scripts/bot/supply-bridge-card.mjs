// "90% OF WHAT?" — the denominator bridge.
//
// Our diamond-hands number is 90% of HELD supply: self-custody wallets only. The FIFO engine
// excludes exchanges, LP and the bridge from that denominator by construction, so the figure
// cannot speak to them — and in public it gets read as "there is no supply left", which is a
// different claim about a different set of coins. CLAUDE.md's standing rule is that a diamond
// number always names its denominator or bridges both; this card IS the bridge.
//
// One bar = every circulating coin. The bracket above spans the slice the 90% is measured on;
// the bracket below spans everything that number never counted. No editorial, no verdict — the
// two brackets and the real tokens do the arguing.
//
// Data: public/onchain.json (the engine's own daily split — held / cexBal / lpBal / bridgeBal /
// burnBal, which reconcile to the full 1B supply).
import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { FONT } from "./font.mjs";
import { esc } from "./svg-util.mjs";
import { brandStripe, cardDepth, auraBg } from "./chrome.mjs";

const png = (svg, w) => new Resvg(svg, { fitTo: { mode: "width", value: w }, font: FONT }).render().asPng();

// Segment colours follow the house conventions: the diamond tier keeps its cyan, exchange supply
// its warm red (cexsupply/cexflow), LP its pink, and bridged coins the violet the chain charts use.
const SEG = {
  diamond: "#22d3ee",
  fresh: "#fbbf24",
  cex: "#fb7185",
  lp: "#f472b6",
  bridge: "#818cf8",
};

const M = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : Math.round(n / 1e3) + "k");
// Rough advance width for the card's sans face. Every clipped label this repo has shipped came from
// guessing that a string would fit — so the layout MEASURES instead, and clamps to the canvas.
const tw = (str, size, bold = false) => String(str).length * size * (bold ? 0.58 : 0.52);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let _cache;
export function supplyBridgeStats() {
  if (_cache !== undefined) return _cache;
  let rows;
  try { rows = JSON.parse(readFileSync(new URL("../../public/onchain.json", import.meta.url), "utf8")); }
  catch { return (_cache = null); }
  const r = Array.isArray(rows) ? rows.at(-1) : null;
  if (!r || !Array.isArray(r.age) || !(r.heldTokens > 0)) return (_cache = null);

  const held = r.heldTokens;
  const diamondPct = r.age[2] + r.age[3] + r.age[4];        // >90 days — the diamond threshold
  const diamond = (diamondPct / 100) * held;
  const fresh = held - diamond;
  const cex = r.cexBal || 0, lp = r.lpBal || 0, bridge = r.bridgeBal || 0, burn = r.burnBal || 0;
  const circulating = 1e9 - burn;                            // the only coins that can ever trade
  const excluded = cex + lp + bridge;                        // never in the diamond denominator
  return (_cache = {
    d: r.d, spot: r.spot, held, diamond, diamondPct, fresh, cex, lp, bridge, burn, circulating, excluded,
    diamondOfAll: (diamond / circulating) * 100,
    sellReady: cex + lp + fresh,                             // at a venue, in a pool, or bought inside 90 days
  });
}

export function supplyBridgeSvg(s, opts = {}) {
  const W = opts.W ?? 1200, H = opts.H ?? 800;
  const mL = 64, mR = 64, barW = W - mL - mR;
  const barY = Math.round(H * 0.46), barH = 122;   // the bar is the card — give it the room, not the margins
  const segs = [
    { k: "diamond", v: s.diamond, label: "diamond hands", sub: "held 90 days+" },
    { k: "fresh", v: s.fresh, label: "held < 90d", sub: "self-custody" },
    { k: "cex", v: s.cex, label: "on exchanges", sub: "" },
    { k: "lp", v: s.lp, label: "LP", sub: "" },
    { k: "bridge", v: s.bridge, label: "bridged", sub: "Base / Solana" },
  ];
  const x0 = v => mL + (v / s.circulating) * barW;

  // the bar itself
  let bar = "", ticks = "", run = 0;
  for (const g of segs) {
    const x = x0(run), w = (g.v / s.circulating) * barW;
    bar += `<rect x="${x.toFixed(1)}" y="${barY}" width="${Math.max(0, w).toFixed(1)}" height="${barH}" fill="${SEG[g.k]}"/>`;
    // only label in place when BOTH lines genuinely fit the segment; the rest are named in the legend
    if (w > tw(M(g.v), 25, true) + 16 && w > tw(g.label, 16, true) + 16) {
      bar += `<text x="${(x + w / 2).toFixed(1)}" y="${barY + barH / 2 - 4}" fill="#05050e" font-size="25" font-weight="800" text-anchor="middle" font-family="sans-serif">${esc(M(g.v))}</text>`;
      bar += `<text x="${(x + w / 2).toFixed(1)}" y="${barY + barH / 2 + 24}" fill="#05050e" font-size="16" font-weight="700" text-anchor="middle" font-family="sans-serif" opacity="0.72">${esc(g.label)}</text>`;
    } else if (w > tw(M(g.v), 19, true) + 10) {
      bar += `<text x="${(x + w / 2).toFixed(1)}" y="${barY + barH / 2 + 7}" fill="#05050e" font-size="19" font-weight="800" text-anchor="middle" font-family="sans-serif">${esc(M(g.v))}</text>`;
    }
    run += g.v;
  }
  // segment dividers so adjacent colours don't blend
  run = 0;
  for (const g of segs) { run += g.v; if (run < s.circulating - 1) ticks += `<rect x="${x0(run).toFixed(1)}" y="${barY}" width="1.6" height="${barH}" fill="#05050e" opacity="0.65"/>`; }

  // A bracket: a rule with two end ticks, label hung off it. `up` puts the ticks above the bar.
  const bracket = (from, to, y, up, color, title, note) => {
    const a = x0(from), b = x0(to), t = up ? 12 : -12;
    // centre on the span, but slide the text back inside the canvas if the span sits near an edge
    const half = Math.max(tw(title, 26, true), tw(note, 20)) / 2;
    const mid = clamp((a + b) / 2, mL + half, W - mR - half);
    const ty = up ? y - 50 : y + 44, ny = up ? y - 22 : y + 72;
    return `<path d="M${a.toFixed(1)},${(y + t).toFixed(1)} L${a.toFixed(1)},${y} L${b.toFixed(1)},${y} L${b.toFixed(1)},${(y + t).toFixed(1)}" fill="none" stroke="${color}" stroke-width="2.4"/>`
      + `<text x="${mid.toFixed(1)}" y="${ty.toFixed(1)}" fill="${color}" font-size="26" font-weight="800" text-anchor="middle" font-family="sans-serif">${esc(title)}</text>`
      + `<text x="${mid.toFixed(1)}" y="${ny.toFixed(1)}" fill="#a9b6c9" font-size="20" text-anchor="middle" font-family="sans-serif">${esc(note)}</text>`;
  };

  const top = bracket(0, s.held, barY - 26, true, "#22d3ee",
    `the "90% diamond hands" is 90% of THIS`,
    `${M(s.held)} held in self-custody · ${s.diamondPct.toFixed(0)}% of it hasn't moved in 90 days`);
  const bot = bracket(s.held, s.circulating, barY + barH + 26, false, "#fb7185",
    `${M(s.excluded)} it never counted`,
    `${M(s.cex)} on exchanges · ${M(s.lp)} in pools · ${M(s.bridge)} bridged`);

  // legend for the thin segments the bar can't label in place
  let legend = "", lx = mL;
  for (const g of segs) {
    const text = `${g.label} ${M(g.v)}`;
    legend += `<rect x="${lx.toFixed(1)}" y="${H - 134}" width="22" height="10" rx="2" fill="${SEG[g.k]}"/>`
      + `<text x="${(lx + 31).toFixed(1)}" y="${H - 124}" fill="#cbd5e1" font-size="19" font-family="sans-serif">${esc(text)}</text>`
      + (g.sub ? `<text x="${(lx + 31).toFixed(1)}" y="${H - 101}" fill="#8b98ad" font-size="16" font-family="sans-serif">${esc(g.sub)}</text>` : "");
    lx += 31 + Math.max(tw(text, 19), g.sub ? tw(g.sub, 16) : 0) + 34;   // flow, so nothing overlaps
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="sbbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0b0b16"/><stop offset="100%" stop-color="#05050e"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sbbg)"/>
${auraBg("#22d3ee", W, H)}
${cardDepth(W, H)}${brandStripe(H)}
<text x="${mL}" y="70" fill="#f8fafc" font-size="39" font-weight="800" font-family="sans-serif" letter-spacing="1">SPX6900 — 90% DIAMOND HANDS, OF WHAT?</text>
<text x="${mL}" y="122" fill="#22d3ee" font-size="32" font-weight="800" font-family="sans-serif">${s.diamondPct.toFixed(0)}% of held supply is ${s.diamondOfAll.toFixed(0)}% of every coin that can trade</text>
<text x="${mL}" y="162" fill="#a9b6c9" font-size="21" font-family="sans-serif">${esc(`one bar = all ${M(s.circulating)} circulating SPX (1B minus the ${M(s.burn)} burned)`)}</text>
${top}${bar}${ticks}${bot}${legend}
<text x="${mL}" y="${H - 58}" fill="#cbd5e1" font-size="21" font-family="sans-serif">${esc(`${M(s.sellReady)} — ${(s.sellReady / s.circulating * 100).toFixed(0)}% of circulating — is on an exchange, in a pool, or was bought inside 90 days.`)}</text>
<text x="${mL}" y="${H - 22}" fill="#8592a6" font-size="18" font-family="sans-serif">${esc(`spx6900rainbow.xyz · ETH-native, FIFO-reconstructed, ${s.d} · a denominator, not a forecast · not financial advice`)}</text>
</svg>`;
}

export const renderSupplyBridgeCard = (stats, dims = {}) => png(supplyBridgeSvg(stats ?? supplyBridgeStats(), dims), dims.W ?? 1200);

// ── THE SAME ARGUMENT, OVER TIME ──────────────────────────────────────────────────────────────
// The bar above answers "90% of WHAT, today". This answers "and when did the two numbers stop
// agreeing" — which is the more useful question, because the gap did not exist at launch. Every
// series is on ONE axis (% of the relevant supply), so there is no second scale to misread:
//
//   • diamond as % of HELD supply     — the figure everyone quotes. Climbs relentlessly.
//   • diamond as % of ALL circulating — the same coins, measured against everything that can trade.
//   • supply on exchanges, % of circulating — the thing that opened the gap.
//
// ⭐ THE FINDING: since mid-2025 the honest line has been FLAT around 55-59% while the quoted one
// climbed from 76% to 90%. That improvement is almost entirely the denominator shrinking as coins
// moved to exchanges — not conviction rising. Diamond TOKENS went 484M → 546M over two years while
// held supply fell 812M → 606M. Both series come from the same engine rows, so this is checkable.

/** [{d, ofHeld, ofCirc, exch}] in percent, plus the latest reading. */
export function diamondGapSeries() {
  let rows;
  try { rows = JSON.parse(readFileSync(new URL("../../public/onchain.json", import.meta.url), "utf8")); }
  catch { return null; }
  if (!Array.isArray(rows)) return null;
  const out = [];
  for (const r of rows) {
    if (!Array.isArray(r.age) || !(r.heldTokens > 0)) continue;
    const circ = 1e9 - (r.burnBal || 0);
    const diamond = ((r.age[2] + r.age[3] + r.age[4]) / 100) * r.heldTokens;
    if (!(circ > 0)) continue;
    out.push({
      ts: Date.parse(r.d), d: r.d,
      ofHeld: (diamond / r.heldTokens) * 100,
      ofCirc: (diamond / circ) * 100,
      exch: ((r.cexBal || 0) / circ) * 100,
    });
  }
  if (out.length < 60) return null;
  const cur = out.at(-1);
  // A reference point far enough back that the two lines had already separated — the comparison the
  // copy leads with. Matched by DATE, so a gap in the daily rows can't silently shift the window.
  const backTo = new Date(cur.ts - 480 * 86400000).toISOString().slice(0, 10);
  const then = out.find(r => r.d >= backTo) || out[0];
  return { rows: out, cur, then, gap: cur.ofHeld - cur.ofCirc };
}

const HELD_C = "#22d3ee", CIRC_C = "#f1f5f9", EXCH_C = "#fb7185";

export function diamondGapSpec(g) {
  const { rows, cur } = g;
  return {
    // the chrome's title is a fixed 38px with no auto-fit (only the headline shrinks), so this has
    // to stay short enough to clear the card on its own — ~34 characters
    title: "DIAMOND HANDS: THE DENOMINATOR GAP",
    headline: `${cur.ofHeld.toFixed(0)}% of held supply — ${cur.ofCirc.toFixed(0)}% of all of it`,
    accent: HELD_C,
    yMin: 0, yMax: 100,
    yFmt: v => `${v}%`,                       // these are percentages; the builder defaults to dollars
    series: [
      { pts: rows.map(r => [r.ts, r.exch]), color: EXCH_C, width: 2.2, fill: 0.16 },
      { pts: rows.map(r => [r.ts, r.ofCirc]), color: CIRC_C, width: 3.4 },
      { pts: rows.map(r => [r.ts, r.ofHeld]), color: HELD_C, width: 3.4 },
    ],
    legend: [
      { label: "diamond · % of held supply (the quoted number)", color: HELD_C },
      { label: "diamond · % of ALL circulating supply", color: CIRC_C },
      { label: "sitting on exchanges, % of circulating", color: EXCH_C },
    ],
    footer: "spx6900rainbow.xyz · held 90 days+, ETH-native, FIFO-reconstructed · not financial advice",
  };
}
