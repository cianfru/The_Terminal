// ============================================================================
// EYEPATCH CARD — the strongest identification case: #3062.
// ============================================================================
//   node research/pfp-forensics/make-eyepatch-card.mjs    -> /tmp/eyepatch-card.png
//
// Input is the real X profile picture we were handed: a heavily pixelated circular crop
// showing an eyepatch, one eye and some hair — none of the goggles, background, clothing
// or figure that make the piece recognisable. Two named features take 3,333 tokens to one.
//
// ⚠ NOTHING HERE IS TYPED BY HAND. The trait counts come from the collection's published
// metadata and the trading figures from the registry's recomputed cluster-scope block. The
// first cut of this card hardcoded "83%", which was the pre-CoW-fix number; it survived a
// recompute that moved the real figure to 100% and went out stale. A card that states a
// number must derive it.
// ============================================================================
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { FONT } from "../../scripts/bot/font.mjs";
import { brandStripe, auraBg, cardDepth, plotPanel } from "../../scripts/bot/chrome.mjs";

const R = p => new URL(p, import.meta.url);
const uri = p => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r2 = n => Number(n.toFixed(2));

const TOKEN = 3062;
const reg = JSON.parse(readFileSync(R("./cases.json"), "utf8"));
const kase = reg.cases.find(c => c.token === TOKEN);
const toks = JSON.parse(readFileSync(R("../../public/aeon-rarity.json"), "utf8")).tokens;
const tv = t => Object.fromEntries(t.traits.map(x => [x.t, x.v]));

// Only what is actually visible in that crop, counted against published metadata.
const VISIBLE = [
  ["every AEON", () => true],
  ["red-cross eyepatch", t => tv(t).Eyewear === "Bandage-Nurse"],
  ["+ black short hair", t => tv(t).Eyewear === "Bandage-Nurse" && tv(t).Hairstyle === "black-short-hair"],
];
export const narrow = (tokens = toks, steps = VISIBLE) =>
  steps.map(([label, f]) => ({ label, n: tokens.filter(f).length }));

const ladder = narrow();
const last = ladder.at(-1);
if (last.n !== 1) throw new Error(`the visible features no longer resolve to one token (${last.n})`);
const hit = toks.find(t => VISIBLE.at(-1)[1](t));
if (hit.id !== TOKEN) throw new Error(`they resolve to #${hit.id}, not #${TOKEN}`);

const ct = kase.clusterTrades;
const buyPct = ct.buys.pctUsdBubblePlus;

const W = 1200, H = 1200, mL = 96;
const CY = "#22d3ee", CY2 = "#67e8f9", VI = "#a78bfa", GRN = "#4ade80", RO = "#fb7185";
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0b0b16"/><stop offset="100%" stop-color="#05050e"/></linearGradient>
<marker id="ar" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L11,6 L0,11 Z" fill="${CY}"/></marker></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${auraBg(CY, W, H, { opacity: 0.24, accent2: VI })}${cardDepth(W, H)}${brandStripe(H)}
<text x="${mL}" y="82" font-family="sans-serif" font-size="43" font-weight="800" fill="#f1f5f9">An eyepatch was enough</text>
<text x="${mL}" y="126" font-family="sans-serif" font-size="23" fill="#94a3b8">A pixelated profile picture, two named features, and 3,333 tokens collapse to one.</text>`;

const ry = 168, box = 254;
s += plotPanel(mL - 20, ry - 20, W - mL * 2 + 40, box + 96);
s += `<text x="${mL + 10}" y="${ry + 14}" font-family="sans-serif" font-size="20" font-weight="700" fill="#94a3b8" letter-spacing="1.4">ALL WE WERE GIVEN</text>`;
const icx = mL + 10 + box / 2, icy = ry + 48 + box / 2;
s += `<circle cx="${icx}" cy="${icy}" r="${box / 2 + 7}" fill="${CY}" fill-opacity="0.18"/>
<defs><clipPath id="ci"><circle cx="${icx}" cy="${icy}" r="${box / 2}"/></clipPath></defs>
<image href="${uri("/tmp/in3062-round.png")}" x="${mL + 10}" y="${ry + 48}" width="${box}" height="${box}" clip-path="url(#ci)"/>
<circle cx="${icx}" cy="${icy}" r="${box / 2}" fill="none" stroke="${CY2}" stroke-width="3.4"/>
<text x="${icx}" y="${ry + 48 + box + 36}" text-anchor="middle" font-family="sans-serif" font-size="21" fill="#64748b">an X profile picture</text>`;
const ax0 = mL + 10 + box + 54, ax1 = W - mL - 10 - box - 54;
s += `<line x1="${ax0}" y1="${icy}" x2="${ax1}" y2="${icy}" stroke="${CY}" stroke-width="4" marker-end="url(#ar)" opacity="0.9"/>
<text x="${(ax0 + ax1) / 2}" y="${icy - 22}" text-anchor="middle" font-family="sans-serif" font-size="25" font-weight="800" fill="${CY2}">${ladder.length - 1} features</text>
<text x="${(ax0 + ax1) / 2}" y="${icy + 44}" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#64748b">no model, no guessing</text>`;
const fx = W - mL - 10 - box;
s += `<text x="${fx}" y="${ry + 14}" font-family="sans-serif" font-size="20" font-weight="700" fill="${GRN}" letter-spacing="1.4">WHICH TOKEN IT IS</text>
<defs><clipPath id="cf"><rect x="${fx}" y="${ry + 48}" width="${box}" height="${box}" rx="14"/></clipPath></defs>
<image href="${uri("/tmp/a3062.png")}" x="${fx}" y="${ry + 48 - box * 0.20}" width="${box}" height="${box * 1.366}" clip-path="url(#cf)"/>
<rect x="${fx}" y="${ry + 48}" width="${box}" height="${box}" rx="14" fill="none" stroke="${GRN}" stroke-width="3.4"/>
<text x="${fx + box / 2}" y="${ry + 48 + box + 36}" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="800" fill="${GRN}">AEON #${TOKEN}</text>`;

let y = ry + box + 158;
s += `<text x="${mL}" y="${y}" font-family="sans-serif" font-size="26" font-weight="800" fill="#e2e8f0">Two features you can see</text>`;
y += 44;
const barX = mL + 330, barW = W - mL - barX - 150;
ladder.forEach(({ label, n }, i) => {
  const yy = y + i * 58, c = i === 0 ? "#64748b" : i === ladder.length - 1 ? GRN : CY;
  const w = Math.max(6, barW * (Math.log10(n) / Math.log10(ladder[0].n)));
  s += `<text x="${mL}" y="${yy + 6}" font-family="sans-serif" font-size="23" fill="${i ? "#cbd5e1" : "#94a3b8"}">${esc(label)}</text>`
     + `<rect x="${barX}" y="${yy - 17}" width="${r2(w)}" height="28" rx="5" fill="${c}" fill-opacity="${i === ladder.length - 1 ? 0.85 : 0.3}" stroke="${c}" stroke-width="1.7"/>`
     + `<text x="${barX + w + 14}" y="${yy + 6}" font-family="sans-serif" font-size="25" font-weight="800" fill="${c}">${n.toLocaleString()}</text>`;
});

y += ladder.length * 58 + 26;
s += `<text x="${mL}" y="${y}" font-family="sans-serif" font-size="21" fill="#94a3b8">Not visible in that crop, and not needed:</text>`
   + `<text x="${mL}" y="${y + 34}" font-family="sans-serif" font-size="23" font-weight="700" fill="${RO}">the goggles · the circus background · the blue tracksuit · the mecha figure</text>`;

y += 86;
s += `<line x1="${mL}" y1="${y}" x2="${W - mL}" y2="${y}" stroke="#ffffff" stroke-opacity="0.10"/>`;
y += 48;
const steps = [["THE WALLET", kase.trader.slice(0, 10) + "…", "holds the token itself"],
               ["ITS RECORD", `${buyPct}%`, "of buy dollars, bubble bands"],
               ["THE HOUSEHOLD", `${kase.clusterWallets} wallets`, "one trader, four vaults"]];
const cw = (W - mL * 2) / 3;
steps.forEach(([k, v, sub], i) => {
  const x = mL + i * cw;
  if (i) s += `<text x="${x - 24}" y="${y + 32}" font-family="sans-serif" font-size="30" fill="${VI}" opacity="0.8">›</text>`;
  s += `<text x="${x}" y="${y}" font-family="sans-serif" font-size="19" font-weight="700" fill="#94a3b8" letter-spacing="1.2">${esc(k)}</text>`
     + `<text x="${x}" y="${y + 46}" font-family="sans-serif" font-size="33" font-weight="800" fill="${VI}">${esc(v)}</text>`
     + `<text x="${x}" y="${y + 78}" font-family="sans-serif" font-size="18" fill="#64748b">${esc(sub)}</text>`;
});
s += `<text x="${mL}" y="${H - 42}" font-family="sans-serif" font-size="20" fill="#64748b">A profile picture never proves who owns a wallet — it is a lead, not an identity.</text>
<text x="${W - 56}" y="${H - 42}" text-anchor="end" font-family="sans-serif" font-size="20" fill="#64748b">spx6900rainbow.xyz</text></svg>`;
writeFileSync("/tmp/eyepatch-card.png", new Resvg(s, { fitTo: { mode: "width", value: W }, font: FONT }).render().asPng());
console.log(`rendered  ladder ${ladder.map(l => l.n).join(" -> ")}  ·  buy% ${buyPct} (from registry, recomputed ${ct.recomputed})`);
