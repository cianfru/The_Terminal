// ============================================================================
// PAIR CARD — two tracked households, one collection, the same rainbow.
// ============================================================================
//   node research/pfp-forensics/make-pair-card.mjs     -> /tmp/pair-card.png
//
// The pair is the story: one wallet wore the picture and sold the top, another wore it
// and bought the top. Same collection, same signal to a reader, opposite behaviour.
//
// ⚠ THE CAPTIONS ARE COMPUTED FROM THE TRADES THE PANEL DRAWS, never quoted from the
// registry. The registry's per-case figures are TRADER-scope and were built before the
// classifier fix; this plots CLUSTER scope. Quoting one over a picture of the other is
// the kind of small mismatch a reader finds and never forgives — and doing it this way
// is what caught that #3062's stored 83%/13 buys/1 sell was stale (really 100%/12/5).
//
// Art is fetched to /tmp by the caller; resvg cannot resolve remote hrefs.
// ============================================================================
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { FONT } from "../../scripts/bot/font.mjs";
import { brandStripe, auraBg, cardDepth } from "../../scripts/bot/chrome.mjs";
import { buildModel, bandVal, bandIndex, BAND_LABELS } from "../../src/models.js";
import { DEFAULT_RAW } from "../../src/data.js";
import { clusterOf, tradeHistory } from "../../scripts/bot/kol-cluster.mjs";

const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const r2 = n => Number(n.toFixed(2));
const fmt = n => Math.round(n).toLocaleString();
const uri = p => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
const D0 = new Date("2023-08-17").getTime();
const dayN = ds => Math.round((new Date(ds + "T00:00:00Z").getTime() - D0) / 864e5);

const px = JSON.parse(readFileSync(new URL("../../public/price-history.json", import.meta.url), "utf8"));
const P = new Map(px.map(r => [r.date.slice(0, 10), r.price]));
const days = [...P.keys()].sort();
const priceOn = d => P.get(d) ?? P.get(days.filter(x => x <= d).pop());
const m = buildModel(DEFAULT_RAW), NB = m.bands.length;

const CASES = [
  { token: 2451, art: "/tmp/a2451.png", head: "sold the top", tone: "#67e8f9",
    sub: c => `${c.sellHot}% of its sell dollars went OUT at \u201cBubble?\u201d or hotter` },
  { token: 3062, art: "/tmp/a3062.png", head: "bought the top", tone: "#fbbf24",
    sub: c => `${c.buyHot}% of its buy dollars went IN at those same levels` },
];
for (const c of CASES) {
  const cl = clusterOf(c.token);
  const rows = await tradeHistory(cl.wallets);
  c.trades = rows.filter(r => r.kind === "buy" || r.kind === "sell")
    .map(r => ({ ...r, price: priceOn(r.ts.slice(0, 10)) }))
    .filter(r => r.price);
  // The caption must describe the SAME trades the panel draws. Quoting the case study's
  // trader-only figures over a chart of the whole cluster is the kind of small mismatch
  // that a reader finds and never forgives.
  const hot = t => bandIndex(m, t.price, dayN(t.ts.slice(0, 10))) >= 5;
  const usd = a => a.reduce((x, t) => x + t.qty * t.price, 0);
  const B = c.trades.filter(t => t.kind === "buy"), S = c.trades.filter(t => t.kind === "sell");
  c.buyHot = Math.round(usd(B.filter(hot)) / usd(B) * 100);
  c.sellHot = S.length ? Math.round(usd(S.filter(hot)) / usd(S) * 100) : 0;
  c.nB = B.length; c.nS = S.length;
}

const W = 1200, H = 1200, mL = 92, mR = 168, PW = W - mL - mR;
const t0 = dayN("2023-10-01"), t1 = dayN(px.at(-1).date.slice(0, 10)) + 10;
const lo = 0.0015, hi = 3.2;
const X = d => mL + (d - t0) / (t1 - t0) * PW;

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0b0b16"/><stop offset="100%" stop-color="#05050e"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${auraBg("#f43f5e", W, H, { opacity: 0.20, accent2: "#22c55e" })}${cardDepth(W, H)}${brandStripe(H)}
<text x="${mL}" y="70" font-family="sans-serif" font-size="42" font-weight="800" fill="#f1f5f9">Same picture. Opposite trade.</text>
<text x="${mL}" y="112" font-family="sans-serif" font-size="23" fill="#94a3b8">Two wallets wearing a Project AEON profile picture, on the same rainbow.</text>`;

const PH = 358, TOP = [214, 672];
CASES.forEach((c, k) => {
  const mT = TOP[k];
  const Y = p => mT + PH - (Math.log10(Math.max(p, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * PH;
  s += `<clipPath id="cp${k}"><rect x="${mL}" y="${mT}" width="${PW}" height="${PH}"/></clipPath><g clip-path="url(#cp${k})">`;
  const step = 8, ds = []; for (let d = t0; d <= t1; d += step) ds.push(d);
  for (let i = 0; i < NB - 1; i++) {
    const up = ds.map(d => `${r2(X(d))},${r2(Y(bandVal(m, d, i + 1)))}`);
    const dn = ds.slice().reverse().map(d => `${r2(X(d))},${r2(Y(bandVal(m, d, i)))}`);
    s += `<polygon points="${up.concat(dn).join(" ")}" fill="${BAND_LABELS[i].c}" fill-opacity="0.26"/>`;
  }
  s += `<polyline points="${px.filter(r => dayN(r.date.slice(0,10)) >= t0).map(r => `${r2(X(dayN(r.date.slice(0,10))))},${r2(Y(r.price))}`).join(" ")}" fill="none" stroke="#f8fafc" stroke-width="2.2" opacity="0.85"/>`;
  const mx = Math.max(...c.trades.map(t => t.qty * t.price));
  const R = v => 7 + 21 * Math.sqrt(v / mx);
  for (const t of c.trades) {
    const col = t.kind === "buy" ? ["#22c55e", "#4ade80"] : ["#f43f5e", "#fb7185"];
    s += `<circle cx="${r2(X(dayN(t.ts.slice(0,10))))}" cy="${r2(Y(t.price))}" r="${r2(R(t.qty * t.price))}" fill="${col[0]}" fill-opacity="0.26" stroke="${col[1]}" stroke-width="2.3"/>`;
  }
  s += `</g>`;
  s += `<rect x="${mL}" y="${mT}" width="${PW}" height="${PH}" fill="none" stroke="#ffffff" stroke-opacity="0.14" rx="8"/>`;
  for (const p of [0.01, 0.1, 1]) if (p > lo && p < hi)
    s += `<text x="${mL - 12}" y="${r2(Y(p) + 6)}" text-anchor="end" font-family="sans-serif" font-size="19" fill="#94a3b8">$${p < 1 ? p.toFixed(2) : p.toFixed(0)}</text>`;
  for (let y = 2024; y <= 2026; y++) { const x = X(dayN(`${y}-01-01`));
    s += `<text x="${r2(x)}" y="${mT + PH + 24}" text-anchor="middle" font-family="sans-serif" font-size="19" fill="#64748b">${y}</text>`; }
  // the piece, at the right edge of its own panel
  const ax = mL + PW + 74, ay = mT + PH / 2, AR = 60;
  const aw = AR * 2, ah = aw * 1.365;
  s += `<defs><clipPath id="pf${k}"><circle cx="${ax}" cy="${ay}" r="${AR}"/></clipPath></defs>
<circle cx="${ax}" cy="${ay}" r="${AR + 7}" fill="${c.tone}" fill-opacity="0.20"/>
<image href="${uri(c.art)}" x="${ax - AR}" y="${r2(ay - ah * 0.44)}" width="${aw}" height="${r2(ah)}" clip-path="url(#pf${k})"/>
<circle cx="${ax}" cy="${ay}" r="${AR}" fill="none" stroke="${c.tone}" stroke-width="3.2"/>
<text x="${ax}" y="${ay + AR + 30}" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="800" fill="#cbd5e1">#${c.token}</text>`;
  // the verdict, above the panel
  s += `<text x="${mL}" y="${mT - 40}" font-family="sans-serif" font-size="29" font-weight="800" fill="${k ? "#4ade80" : "#fb7185"}">AEON #${c.token} — ${esc(c.head)}</text>`
     + `<text x="${mL}" y="${mT - 22}" font-family="sans-serif" font-size="20" fill="#94a3b8">${esc(c.sub(c))} \u00b7 ${c.nB} buys, ${c.nS} sell${c.nS === 1 ? "" : "s"}</text>`;
});

s += `<text x="${mL}" y="${H - 78}" font-family="sans-serif" font-size="22" fill="#cbd5e1"><tspan fill="#4ade80" font-weight="800">●</tspan> buys   <tspan fill="#fb7185" font-weight="800">●</tspan> sells   · sized by dollars · bands are our frozen power-law model, never re-fitted</text>
<text x="${mL}" y="${H - 42}" font-family="sans-serif" font-size="20" fill="#64748b">A profile picture never proves who owns a wallet — it is a lead, not an identity.</text>
<text x="${W - 52}" y="${H - 42}" text-anchor="end" font-family="sans-serif" font-size="20" fill="#64748b">spx6900rainbow.xyz</text></svg>`;
writeFileSync("/tmp/pair-card.png", new Resvg(s, { fitTo: { mode: "width", value: W }, font: FONT }).render().asPng());
console.log("rendered", CASES.map(c => `#${c.token}: ${c.trades.length} trades`).join(" | "));
