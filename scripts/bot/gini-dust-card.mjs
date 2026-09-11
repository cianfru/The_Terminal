// "Why the Gini says 0.97" card — the counterintuitive read on SPX6900's inequality number.
//
// A 0.97 Gini reads like "a few wallets own everything". The data says the opposite: Gini ROSE
// (0.84 → 0.97) while REAL concentration FELL (top 100: 85% → 57% of holder supply). Both moved,
// in opposite directions — because Gini is dominated by the DUST TAIL. The holder base went
// 572 → ~49,000 wallets and ~60% of them hold under $100, and every new small holder pushes Gini
// toward 1 even as the whales' grip loosens. That divergence is exactly why the concentration
// chart publishes top-N share and deliberately leaves Gini OFF (see CLAUDE.md) — this card is its
// "here's why" companion. A distribution-of-ownership statement, NOT a signal.
//
// The two lines cross early and then fan apart, so the explanatory text sits in the corridor the
// divergence opens up. Dual scale: Gini on the left (0.80–1.00), top-100 share on the right
// (50–90%) — five shared gridlines, so both axes land on round numbers at the same y positions.
// Data: stats.onchain — gini, top100, holders, and `wealth` (wallet COUNTS per USD bracket).
import { Resvg } from "@resvg/resvg-js";
import { FONT } from "./font.mjs";
import { esc } from "./svg-util.mjs";
import { brandStripe, cardDepth } from "./chrome.mjs";

const png = (svg, w) => new Resvg(svg, { fitTo: { mode: "width", value: w }, font: FONT }).render().asPng();
const GINI = "#fb7185", CONC = "#22d3ee"; // the scary number (rose) vs the real one (cyan)
const G_LO = 0.80, G_HI = 1.00, C_LO = 50, C_HI = 90; // both split into 5 round ticks

export function giniDustSvg(stats, opts = {}) {
  const oc = stats.onchain || [];
  const raw = oc
    .filter(r => Number.isFinite(r.gini) && Number.isFinite(r.top100))
    .map(r => ({ ts: Date.parse(r.d), g: r.gini, c: r.top100, h: r.holders }))
    .filter(r => Number.isFinite(r.ts))
    .sort((a, b) => a.ts - b.ts);
  if (raw.length < 50) return null;
  const first = raw[0], cur = raw.at(-1);
  // Dust tail: share of wallets in the smallest USD bracket (<$100), from the latest row.
  const lastRow = oc.at(-1);
  const dustPct = Array.isArray(lastRow?.wealth) && lastRow.holders > 0
    ? (lastRow.wealth[0] / lastRow.holders) * 100 : null;

  const W = opts.W ?? 1200, H = opts.H ?? 630, mL = 96, mR = 104, mT = 156, mB = 92;
  const pW = W - mL - mR, pH = H - mT - mB;
  const t0 = first.ts, t1 = cur.ts;
  const x = t => mL + ((t - t0) / ((t1 - t0) || 1)) * pW;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const yG = v => mT + (1 - (clamp(v, G_LO, G_HI) - G_LO) / (G_HI - G_LO)) * pH;
  const yC = v => mT + (1 - (clamp(v, C_LO, C_HI) - C_LO) / (C_HI - C_LO)) * pH;

  // Five shared gridlines — left labelled in Gini, right in top-100 %.
  let grid = "";
  for (let i = 0; i < 5; i++) {
    const f = i / 4, yy = (mT + (1 - f) * pH).toFixed(1);
    const gv = (G_LO + f * (G_HI - G_LO)).toFixed(2);
    const cv = Math.round(C_LO + f * (C_HI - C_LO));
    grid += `<line x1="${mL}" y1="${yy}" x2="${W - mR}" y2="${yy}" stroke="rgba(255,255,255,0.12)"/>`
      + `<text x="${mL - 14}" y="${(+yy + 8).toFixed(1)}" fill="#94a3b8" font-size="22" text-anchor="end" font-family="sans-serif">${gv}</text>`
      + `<text x="${(W - mR + 14).toFixed(1)}" y="${(+yy + 8).toFixed(1)}" fill="#94a3b8" font-size="22" text-anchor="start" font-family="sans-serif">${cv}%</text>`;
  }
  let xlab = "";
  for (let yr = new Date(t0).getUTCFullYear(); yr <= new Date(t1).getUTCFullYear(); yr++) {
    const t = Date.UTC(yr, 0, 1); if (t < t0 || t > t1) continue;
    xlab += `<text x="${x(t).toFixed(1)}" y="${H - 46}" fill="#94a3b8" font-size="22" text-anchor="middle" font-family="sans-serif">${yr}</text>`;
  }

  const lineG = raw.map(r => `${x(r.ts).toFixed(1)},${yG(r.g).toFixed(1)}`).join(" ");
  const lineC = raw.map(r => `${x(r.ts).toFixed(1)},${yC(r.c).toFixed(1)}`).join(" ");

  // The explanation sits in the corridor the two diverging lines open up.
  const midX = (mL + pW * 0.56).toFixed(1), midY = mT + pH * 0.47;
  const note = dustPct != null
    ? `${dustPct.toFixed(0)}% of wallets hold under $100`
    : `most wallets hold a dust-sized balance`;

  const hero = `Gini rose ${first.g.toFixed(2)} → ${cur.g.toFixed(2)} while the top 100 fell ${first.c.toFixed(0)}% → ${cur.c.toFixed(0)}%`;
  const sub = dustPct != null
    ? `Gini counts every wallet — and ${dustPct.toFixed(0)}% of them hold under $100`
    : `Gini counts every wallet, including the dust`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="gdbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0b0b16"/><stop offset="100%" stop-color="#05050e"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#gdbg)"/>
${cardDepth(W, H)}${brandStripe(H)}
<text x="60" y="56" fill="#f1f5f9" font-size="36" font-weight="800" font-family="sans-serif" letter-spacing="1">${esc(`SPX6900 — WHY THE GINI SAYS ${cur.g.toFixed(2)}`)}</text>
<text x="60" y="100" fill="${GINI}" font-size="26" font-weight="800" font-family="sans-serif">${esc(hero)}</text>
<text x="60" y="130" fill="#94a3b8" font-size="21" font-family="sans-serif">${esc(sub)}</text>
${grid}${xlab}
<polyline points="${lineC}" fill="none" stroke="${CONC}" stroke-width="5.4" stroke-linejoin="round" stroke-linecap="round"/>
<polyline points="${lineG}" fill="none" stroke="${GINI}" stroke-width="5.4" stroke-linejoin="round" stroke-linecap="round"/>
<text x="${midX}" y="${midY.toFixed(1)}" fill="#e2e8f0" font-size="24" font-weight="700" text-anchor="middle" font-family="sans-serif">${esc(note)}</text>
<text x="${midX}" y="${(midY + 30).toFixed(1)}" fill="#94a3b8" font-size="19" text-anchor="middle" font-family="sans-serif">${esc(`holders ${first.h?.toLocaleString?.() ?? first.h} → ${cur.h?.toLocaleString?.() ?? cur.h} · every new small wallet lifts Gini`)}</text>
<circle cx="${x(cur.ts).toFixed(1)}" cy="${yG(cur.g).toFixed(1)}" r="8" fill="${GINI}" stroke="#05050e" stroke-width="2"/>
<text x="${(x(cur.ts) - 14).toFixed(1)}" y="${(yG(cur.g) - 18).toFixed(1)}" fill="${GINI}" font-size="22" font-weight="800" text-anchor="end" font-family="sans-serif">GINI ${cur.g.toFixed(2)}</text>
<circle cx="${x(cur.ts).toFixed(1)}" cy="${yC(cur.c).toFixed(1)}" r="8" fill="${CONC}" stroke="#05050e" stroke-width="2"/>
<text x="${(x(cur.ts) - 14).toFixed(1)}" y="${(yC(cur.c) + 34).toFixed(1)}" fill="${CONC}" font-size="22" font-weight="800" text-anchor="end" font-family="sans-serif">TOP 100 · ${cur.c.toFixed(0)}%</text>
<text x="${(x(first.ts) + 12).toFixed(1)}" y="${(yG(first.g) + 32).toFixed(1)}" fill="${GINI}" font-size="20" font-weight="700" text-anchor="start" font-family="sans-serif">${first.g.toFixed(2)}</text>
<text x="${(x(first.ts) + 12).toFixed(1)}" y="${(yC(first.c) - 16).toFixed(1)}" fill="${CONC}" font-size="20" font-weight="700" text-anchor="start" font-family="sans-serif">${first.c.toFixed(0)}%</text>
<text x="60" y="${H - 20}" fill="#8592a6" font-size="18" font-family="sans-serif">${esc("spx6900rainbow.xyz · not financial advice · ETH-native · exchanges, LP & bridge excluded")}</text>
</svg>`;
}

export function renderGiniDustCard(stats, opts = {}) {
  const svg = giniDustSvg(stats, { W: opts.W, H: opts.H });
  return svg ? png(svg, opts.W ?? 1200) : null;
}
