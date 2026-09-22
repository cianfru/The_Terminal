// ============================================================================
// TRADES CARD — where a tracked household bought and sold, on the rainbow bands.
// ============================================================================
//   node research/pfp-forensics/make-trades-card.mjs --case=3062   -> /tmp/trades-<token>.png
//
// ⚠ THIS EXISTS BECAUSE THE HAND-BUILT VERSION WENT STALE AND NEARLY GOT PUBLISHED.
// research/pfp-forensics/charts/3062-rainbow.png was rendered before the CoW counterparty
// fix and froze that moment: "83%" of dollars in bubble bands, "$18,048" spent at an
// average of "$0.7853", and the line "Its single sale came in Still Cheap at $0.6080" —
// one red circle on the whole chart. The truth is 100%, $14,952 at $1.2016, and FIVE
// sales ending at $0.3972 in the BUY! band. It would have contradicted its own post.
//
// So nothing here is written down. Every number, every circle, every band total and the
// closing sentence are derived at render time from the same validated classifier the
// watcher uses (scripts/bot/kol-cluster.mjs), which keys on where the TOKENS went rather
// than what the transaction called — the shortcut that lost those four aggregator sells.
//
// Parameterised by case, so the next one cannot drift either.
// ============================================================================
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { FONT } from "../../scripts/bot/font.mjs";
import { brandStripe, auraBg, cardDepth, plotPanel } from "../../scripts/bot/chrome.mjs";
import { buildModel, bandVal, bandIndex, BAND_LABELS } from "../../src/models.js";
import { DEFAULT_RAW } from "../../src/data.js";
import { clusterOf, tradeHistory } from "../../scripts/bot/kol-cluster.mjs";

const R = p => new URL(p, import.meta.url);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r2 = n => Number(n.toFixed(2));
const f = n => Math.round(n).toLocaleString();
const money = n => `$${f(n)}`;
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=")[1] ?? d;

const TOKEN = Number(arg("case", 3062));
const D0 = new Date("2023-08-17").getTime();
const dayN = ds => Math.round((new Date(ds + "T00:00:00Z").getTime() - D0) / 864e5);

const px = JSON.parse(readFileSync(R("../../public/price-history.json"), "utf8"));
const P = new Map(px.map(r => [r.date.slice(0, 10), r.price]));
const dl = [...P.keys()].sort();
const priceOn = d => P.get(d) ?? P.get(dl.filter(x => x <= d).pop());
const m = buildModel(DEFAULT_RAW), NB = m.bands.length;
const BUBBLE = 5;                       // band index 5 = "Bubble?"; anything at or above is hot

const cl = clusterOf(TOKEN);
const rows = (await tradeHistory(cl.wallets))
  .map(r => ({ ...r, price: priceOn(r.ts.slice(0, 10)) }))
  .filter(r => r.price)
  .map(r => ({ ...r, usd: r.qty * r.price, band: bandIndex(m, r.price, dayN(r.ts.slice(0, 10))) }))
  .sort((a, b) => a.ts.localeCompare(b.ts));
const B = rows.filter(r => r.kind === "buy"), S = rows.filter(r => r.kind === "sell");
if (!B.length && !S.length) throw new Error(`case #${TOKEN} has no market trades to draw`);

const sum = (a, k) => a.reduce((s, t) => s + t[k], 0);
const boughtU = sum(B, "usd"), soldU = sum(S, "usd"), boughtQ = sum(B, "qty"), soldQ = sum(S, "qty");
const avgBuy = boughtQ ? boughtU / boughtQ : 0, avgSell = soldQ ? soldU / soldQ : 0;
const hotBuy = boughtU ? sum(B.filter(r => r.band >= BUBBLE), "usd") / boughtU * 100 : 0;
const hotSell = soldU ? sum(S.filter(r => r.band >= BUBBLE), "usd") / soldU * 100 : 0;

// window: the household's own era, padded, never the whole history — the trades are the subject
const t0 = dayN(rows[0].ts.slice(0, 10)) - 60;
const t1 = dayN(px.at(-1).date.slice(0, 10)) + 10;
const inWin = px.filter(r => { const d = dayN(r.date.slice(0, 10)); return d >= t0 && d <= t1; });
const lo = Math.min(...inWin.map(r => r.price), ...rows.map(r => r.price)) * 0.72;
const hi = Math.max(...inWin.map(r => r.price), ...rows.map(r => r.price)) * 1.5;

// ⚠ mB IS LOAD-BEARING. The closing two lines sit below the figures and the disclaimer is
// pinned to H-38; at mB=300 the second line landed at y=1156 against a footer at 1162 and
// the two printed through each other. Any change to the figure block must re-check that gap.
const W = 1200, H = 1200, mL = 96, mR = 300, mT = 250, mB = 336;
const PW = W - mL - mR, PH = H - mT - mB;
const X = d => mL + (d - t0) / (t1 - t0) * PW;
const Y = p => mT + PH - (Math.log10(Math.max(p, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * PH;
const GRN = "#22c55e", GRN2 = "#4ade80", RO = "#f43f5e", RO2 = "#fb7185";

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0b0b16"/><stop offset="100%" stop-color="#05050e"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${auraBg(RO, W, H, { opacity: 0.26, accent2: GRN })}${cardDepth(W, H)}${brandStripe(H)}
<text x="${mL}" y="78" font-family="sans-serif" font-size="40" font-weight="800" fill="#f1f5f9">Where it bought, and where it sold</text>
<text x="${mL}" y="126" font-family="sans-serif" font-size="40" font-weight="800" fill="${RO2}">${esc(`${Math.round(hotBuy)}% of every dollar spent went in hot`)}</text>
<text x="${mL}" y="170" font-family="sans-serif" font-size="22" fill="#94a3b8">Every market trade this household ever made, on the frozen rainbow. Circle area = dollars.</text>
<text x="${mL}" y="204" font-family="sans-serif" font-size="20" fill="#64748b">Case study #${cl.study ?? "—"} — AEON #${TOKEN}. The model is never re-fitted; the bands record where each decision landed.</text>
${plotPanel(mL - 22, mT - 22, PW + 44, PH + 44)}`;

const step = 4, ds = []; for (let d = t0; d <= t1; d += step) ds.push(d);
s += `<clipPath id="cp"><rect x="${mL}" y="${mT}" width="${PW}" height="${PH}"/></clipPath><g clip-path="url(#cp)">`;
for (let i = 0; i < NB - 1; i++) {
  const up = ds.map(d => `${r2(X(d))},${r2(Y(bandVal(m, d, i + 1)))}`);
  const dn = ds.slice().reverse().map(d => `${r2(X(d))},${r2(Y(bandVal(m, d, i)))}`);
  s += `<polygon points="${up.concat(dn).join(" ")}" fill="${BAND_LABELS[i].c}" fill-opacity="0.26"/>`;
}
s += `<polyline points="${inWin.map(r => `${r2(X(dayN(r.date.slice(0,10))))},${r2(Y(r.price))}`).join(" ")}" fill="none" stroke="#f8fafc" stroke-width="2.2" opacity="0.9"/>`;
const mx = Math.max(...rows.map(r => r.usd));
const RAD = u => 9 + 30 * Math.sqrt(u / mx);
for (const t of S) s += `<circle cx="${r2(X(dayN(t.ts.slice(0,10))))}" cy="${r2(Y(t.price))}" r="${r2(RAD(t.usd))}" fill="${RO}" fill-opacity="0.26" stroke="${RO2}" stroke-width="2.6"/>`;
for (const t of B) s += `<circle cx="${r2(X(dayN(t.ts.slice(0,10))))}" cy="${r2(Y(t.price))}" r="${r2(RAD(t.usd))}" fill="${GRN}" fill-opacity="0.28" stroke="${GRN2}" stroke-width="2.6"/>`;
s += `</g>`;

// y ticks chosen from the actual range, so a card can never print a label off its own scale
const ticks = [0.2, 0.5, 1, 2, 4, 10].filter(p => p >= lo * 1.05 && p <= hi * 0.95);
for (const p of ticks)
  s += `<text x="${mL - 12}" y="${r2(Y(p) + 7)}" text-anchor="end" font-family="sans-serif" font-size="20" fill="#94a3b8">$${p < 1 ? p.toFixed(2) : p.toFixed(0)}</text>`;
const y0 = Number(rows[0].ts.slice(0, 4)), y1 = Number(px.at(-1).date.slice(0, 4));
for (let yy = y0; yy <= y1; yy++) {
  const x = X(dayN(`${yy}-01-01`));
  if (x < mL || x > mL + PW) continue;
  s += `<text x="${r2(x)}" y="${mT + PH + 36}" text-anchor="middle" font-family="sans-serif" font-size="21" fill="#94a3b8">${yy}</text>`;
}

// the sell ladder, in the order it happened and labelled by the band it landed in
let ly = mT + 4;
s += `<text x="${mL + PW + 28}" y="${ly}" font-family="sans-serif" font-size="18" font-weight="700" fill="${RO2}" letter-spacing="1">WHERE IT SOLD</text>`;
ly += 30;
for (const t of S.slice(0, 8)) {
  const lab = BAND_LABELS[t.band]?.l ?? "?";
  s += `<rect x="${mL + PW + 28}" y="${ly - 12}" width="13" height="13" rx="3" fill="${BAND_LABELS[t.band]?.c ?? "#64748b"}"/>`
     + `<text x="${mL + PW + 48}" y="${ly}" font-family="sans-serif" font-size="17" fill="#cbd5e1">${esc(lab)}</text>`
     + `<text x="${mL + PW + 48}" y="${ly + 21}" font-family="sans-serif" font-size="16" fill="#64748b">$${t.price.toFixed(4)} · ${f(t.qty)} SPX</text>`;
  ly += 50;
}
if (!S.length) s += `<text x="${mL + PW + 28}" y="${ly}" font-family="sans-serif" font-size="17" fill="#64748b">never sold</text>`;

// figures, derived
let y = mT + PH + 96;
s += `<line x1="${mL}" y1="${y - 42}" x2="${W - mL}" y2="${y - 42}" stroke="#ffffff" stroke-opacity="0.10"/>`;
const cells = [
  ["BOUGHT", money(boughtU), `${f(boughtQ)} SPX · avg $${avgBuy.toFixed(4)}`, GRN2],
  ["SOLD", money(soldU), soldQ ? `${f(soldQ)} SPX · avg $${avgSell.toFixed(4)}` : "never sold", RO2],
  ["STILL HOLDS", f(cl.holdsNow), "SPX across the household", "#67e8f9"],
];
const cw = (W - mL * 2) / 3;
cells.forEach(([k, v, sub, c], i) => {
  const x = mL + i * cw;
  s += `<text x="${x}" y="${y}" font-family="sans-serif" font-size="18" font-weight="700" fill="#94a3b8" letter-spacing="1.1">${esc(k)}</text>`
     + `<text x="${x}" y="${y + 46}" font-family="sans-serif" font-size="36" font-weight="800" fill="${c}">${esc(v)}</text>`
     + `<text x="${x}" y="${y + 76}" font-family="sans-serif" font-size="18" fill="#64748b">${esc(sub)}</text>`;
});

// the closing line states only what the trades show
y += 126;
const line1 = soldQ
  ? `${B.length} buys at an average of $${avgBuy.toFixed(4)}, ${S.length} sales at an average of $${avgSell.toFixed(4)}.`
  : `${B.length} buys at an average of $${avgBuy.toFixed(4)}, and not one sale.`;
const line2 = soldU
  ? `${Math.round(hotSell)}% of the dollars it took out came from "Bubble?" or hotter.`
  : `Every dollar it spent is still on the table.`;
s += `<text x="${mL}" y="${y}" font-family="sans-serif" font-size="24" font-weight="700" fill="#e2e8f0">${esc(line1)}</text>`
   + `<text x="${mL}" y="${y + 34}" font-family="sans-serif" font-size="20" fill="#94a3b8">${esc(line2)}</text>`;
s += `<text x="${mL}" y="${H - 38}" font-family="sans-serif" font-size="18" fill="#64748b">A profile picture never proves who owns a wallet — it is a lead, not an identity.</text>
<text x="${W - 52}" y="${H - 38}" text-anchor="end" font-family="sans-serif" font-size="18" fill="#64748b">spx6900rainbow.xyz</text></svg>`;

const out = `/tmp/trades-${TOKEN}.png`;
writeFileSync(out, new Resvg(s, { fitTo: { mode: "width", value: W }, font: FONT }).render().asPng());
console.log(`${out}  ${B.length} buys ${money(boughtU)} @ $${avgBuy.toFixed(4)} (${Math.round(hotBuy)}% hot) · ${S.length} sells ${money(soldU)} @ $${avgSell.toFixed(4)} (${Math.round(hotSell)}% hot) · holds ${f(cl.holdsNow)}`);
