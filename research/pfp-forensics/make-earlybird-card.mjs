// ============================================================================
// EARLY-BIRD CARD — case #14: the best entry of the four, and none of it survived.
// ============================================================================
//   node research/pfp-forensics/make-earlybird-card.mjs   -> /tmp/earlybird-card.png
//
// This household bought 7.2M SPX for about $33,000 starting two weeks after launch, at
// an average of $0.0046. It sold under a third on the market, moved the rest out, and
// holds nothing. Its last market trade was June 2024.
//
// ⚠ WHAT THIS CARD MUST NOT SAY. The 5.1M that left the cluster did NOT necessarily go
// unrealised — it went to 23 addresses we cannot link back, and the trail stops there.
// "They left $3.8M on the table" would be a claim about money we cannot follow. The card
// states what it bought, what it sold ON THE MARKET, what it moved, and what it holds —
// and says plainly that the rest is unknown.
//
// Every figure is derived at render time. Art is fetched to /tmp by the caller.
// ============================================================================
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { FONT } from "../../scripts/bot/font.mjs";
import { brandStripe, auraBg, cardDepth, plotPanel } from "../../scripts/bot/chrome.mjs";
import { buildModel, bandVal, BAND_LABELS } from "../../src/models.js";
import { DEFAULT_RAW } from "../../src/data.js";
import { clusterOf, tradeHistory } from "../../scripts/bot/kol-cluster.mjs";

const R = p => new URL(p, import.meta.url);
const uri = p => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r2 = n => Number(n.toFixed(2));
const f = n => Math.round(n).toLocaleString();
const D0 = new Date("2023-08-17").getTime();
const dayN = ds => Math.round((new Date(ds + "T00:00:00Z").getTime() - D0) / 864e5);

const TOKEN = 14;
const px = JSON.parse(readFileSync(R("../../public/price-history.json"), "utf8"));
const P = new Map(px.map(r => [r.date.slice(0, 10), r.price]));
const dl = [...P.keys()].sort();
const priceOn = d => P.get(d) ?? P.get(dl.filter(x => x <= d).pop());
const spot = px.at(-1).price;
const m = buildModel(DEFAULT_RAW), NB = m.bands.length;

const cl = clusterOf(TOKEN);
const rows = (await tradeHistory(cl.wallets)).map(r => ({ ...r, price: priceOn(r.ts.slice(0, 10)) })).filter(r => r.price);
const B = rows.filter(r => r.kind === "buy"), S = rows.filter(r => r.kind === "sell");
const q = a => a.reduce((x, t) => x + t.qty, 0), u = a => a.reduce((x, t) => x + t.qty * t.price, 0);
const boughtQ = q(B), boughtU = u(B), soldQ = q(S), soldU = u(S);
const movedOut = boughtQ - soldQ - cl.holdsNow;   // what left the cluster, neither sold nor held
const firstBuy = B.slice().sort((a, b) => a.ts.localeCompare(b.ts))[0];
const lastTrade = [...B, ...S].sort((a, b) => a.ts.localeCompare(b.ts)).at(-1);

const W = 1200, H = 1200, mL = 100, mR = 196, mT = 268, mB = 372;
const PW = W - mL - mR, PH = H - mT - mB;
const t0 = dayN("2023-08-20"), t1 = dayN(px.at(-1).date.slice(0, 10)) + 10;
const lo = 0.0012, hi = 3.4;
const X = d => mL + (d - t0) / (t1 - t0) * PW;
const Y = p => mT + PH - (Math.log10(Math.max(p, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * PH;
const GRN = "#22c55e", GRN2 = "#4ade80", RO = "#f43f5e", RO2 = "#fb7185", VI = "#a78bfa";

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0b0b16"/><stop offset="100%" stop-color="#05050e"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${auraBg(GRN, W, H, { opacity: 0.24, accent2: VI })}${cardDepth(W, H)}${brandStripe(H)}
<text x="${mL}" y="80" font-family="sans-serif" font-size="41" font-weight="800" fill="#f1f5f9">They bought 7.2 million SPX for $33,430</text>
<text x="${mL}" y="130" font-family="sans-serif" font-size="41" font-weight="800" fill="${GRN2}">two weeks after launch</text>
<text x="${mL}" y="176" font-family="sans-serif" font-size="23" fill="#94a3b8">Seventeen market buys averaging $0.0046 \u2014 the best entry of any wallet we have traced.</text>
<text x="${mL}" y="212" font-family="sans-serif" font-size="21" fill="#64748b">AEON #${TOKEN} — identified from the profile picture. Last market trade: ${esc(lastTrade.ts.slice(0, 10))}.</text>
${plotPanel(mL - 24, mT - 24, PW + 48, PH + 48)}`;

const step = 7, ds = []; for (let d = t0; d <= t1; d += step) ds.push(d);
s += `<clipPath id="cp"><rect x="${mL}" y="${mT}" width="${PW}" height="${PH}"/></clipPath><g clip-path="url(#cp)">`;
for (let i = 0; i < NB - 1; i++) {
  const up = ds.map(d => `${r2(X(d))},${r2(Y(bandVal(m, d, i + 1)))}`);
  const dn = ds.slice().reverse().map(d => `${r2(X(d))},${r2(Y(bandVal(m, d, i)))}`);
  s += `<polygon points="${up.concat(dn).join(" ")}" fill="${BAND_LABELS[i].c}" fill-opacity="0.24"/>`;
}
s += `<polyline points="${px.filter(r => dayN(r.date.slice(0,10)) >= t0).map(r => `${r2(X(dayN(r.date.slice(0,10))))},${r2(Y(r.price))}`).join(" ")}" fill="none" stroke="#f8fafc" stroke-width="2.3" opacity="0.88"/>`;
const mx = Math.max(...[...B, ...S].map(t => t.qty));
const RAD = n => 8 + 26 * Math.sqrt(n / mx);
for (const t of S) s += `<circle cx="${r2(X(dayN(t.ts.slice(0,10))))}" cy="${r2(Y(t.price))}" r="${r2(RAD(t.qty))}" fill="${RO}" fill-opacity="0.26" stroke="${RO2}" stroke-width="2.4"/>`;
for (const t of B) s += `<circle cx="${r2(X(dayN(t.ts.slice(0,10))))}" cy="${r2(Y(t.price))}" r="${r2(RAD(t.qty))}" fill="${GRN}" fill-opacity="0.30" stroke="${GRN2}" stroke-width="2.6"/>`;
s += `</g>`;
// the moment it stopped
const lx = X(dayN(lastTrade.ts.slice(0, 10)));
s += `<line x1="${r2(lx)}" y1="${mT}" x2="${r2(lx)}" y2="${mT + PH}" stroke="${VI}" stroke-width="2.4" stroke-dasharray="9 7" opacity="0.85"/>
<text x="${r2(lx + 14)}" y="${mT + 32}" font-family="sans-serif" font-size="21" font-weight="700" fill="${VI}">then nothing — for over two years</text>`;
for (const p of [0.01, 0.1, 1]) s += `<text x="${mL - 14}" y="${r2(Y(p) + 7)}" text-anchor="end" font-family="sans-serif" font-size="21" fill="#94a3b8">$${p < 1 ? p.toFixed(2) : p.toFixed(0)}</text>`;
for (let yy = 2024; yy <= 2026; yy++) { const x = X(dayN(`${yy}-01-01`));
  s += `<text x="${r2(x)}" y="${mT + PH + 38}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#94a3b8">${yy}</text>`; }
// the piece
const ax = mL + PW + 82, ay = mT + 74, AR = 62, aw = AR * 2, ah = aw * 1.363;
s += `<defs><clipPath id="pf"><circle cx="${ax}" cy="${ay}" r="${AR}"/></clipPath></defs>
<circle cx="${ax}" cy="${ay}" r="${AR + 7}" fill="${GRN}" fill-opacity="0.18"/>
<image href="${uri("/tmp/a14.png")}" x="${ax - AR}" y="${r2(ay - ah * 0.46)}" width="${aw}" height="${r2(ah)}" clip-path="url(#pf)"/>
<circle cx="${ax}" cy="${ay}" r="${AR}" fill="none" stroke="${GRN2}" stroke-width="3.2"/>
<text x="${ax}" y="${ay + AR + 28}" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="800" fill="#cbd5e1">#${TOKEN}</text>`;

// where it all went — stated only as far as the chain proves
let y = mT + PH + 96;
s += `<line x1="${mL}" y1="${y - 40}" x2="${W - mL}" y2="${y - 40}" stroke="#ffffff" stroke-opacity="0.10"/>`;
const cells = [["SOLD ON THE MARKET", `${f(soldQ)}`, `for $${f(soldU)} · ${Math.round(soldQ / boughtQ * 100)}% of what it bought`, RO2],
               ["TRANSFERRED AWAY", `${f(movedOut)}`, "to 23 addresses, unlinkable", VI],
               ["HOLDS TODAY", "0", "nothing, since July 2024", "#94a3b8"]];
const cw = (W - mL * 2) / 3;
cells.forEach(([k, v, sub, c], i) => {
  const x = mL + i * cw;
  s += `<text x="${x}" y="${y}" font-family="sans-serif" font-size="18" font-weight="700" fill="#94a3b8" letter-spacing="1.1">${esc(k)}</text>`
     + `<text x="${x}" y="${y + 48}" font-family="sans-serif" font-size="38" font-weight="800" fill="${c}">${esc(v)}</text>`
     + `<text x="${x}" y="${y + 80}" font-family="sans-serif" font-size="18" fill="#64748b">${esc(sub)}</text>`;
});
y += 132;
s += `<text x="${mL}" y="${y}" font-family="sans-serif" font-size="25" font-weight="700" fill="#e2e8f0">What it bought would be worth $${f(boughtQ * spot)} today.</text>`
   + `<text x="${mL}" y="${y + 36}" font-family="sans-serif" font-size="21" fill="#94a3b8">It realised $${f(soldU)} of that on the market. Where the rest went after it left, the chain does not say.</text>`;
s += `<text x="${mL}" y="${H - 40}" font-family="sans-serif" font-size="19" fill="#64748b">A profile picture never proves who owns a wallet — it is a lead, not an identity.</text>
<text x="${W - 54}" y="${H - 40}" text-anchor="end" font-family="sans-serif" font-size="19" fill="#64748b">spx6900rainbow.xyz</text></svg>`;
writeFileSync("/tmp/earlybird-card.png", new Resvg(s, { fitTo: { mode: "width", value: W }, font: FONT }).render().asPng());
console.log(`rendered  bought ${f(boughtQ)} for $${f(boughtU)} · sold ${f(soldQ)} for $${f(soldU)} · moved ${f(movedOut)} · holds ${cl.holdsNow} · worth today $${f(boughtQ * spot)}`);
