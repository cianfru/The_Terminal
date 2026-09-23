// WALLET ARCHETYPES — what a wallet DOES, from 90 days of flow.
//
// Profiling one address at a time answers one question. The same fields already exist for 400
// wallets in cex-sankey.json, so the behaviour that stood out on a single wallet can be checked
// against the whole active set: is it rare, or is it the norm?
//
// These are BEHAVIOURAL labels, not identity claims. "router" means value passed through and none
// stayed; it does not say who runs it or why. Nothing here is written back into EXCLUDE_LABELS,
// which still only changes when the owner edits it by hand.
//
//   node scripts/build-wallet-archetypes.mjs [--out=public/wallet-archetypes.json]
import { readFileSync, writeFileSync } from "node:fs";

/** Net retention: +1 everything that arrived stayed, 0 everything left, -1 it only ever sent. */
export const retention = p => {
  const tot = p.volIn + p.volOut;
  return tot === 0 ? 0 : (p.volIn - p.volOut) / tot;
};

/** Count asymmetry: +1 only ever received, -1 only ever sent. */
export const skew = p => {
  const tot = p.txIn + p.txOut;
  return tot === 0 ? 0 : (p.txIn - p.txOut) / tot;
};

// Thresholds are read off the measured distribution of the 400 profiles rather than chosen:
// retention is 0.000 at p25/p50/p75, so "balanced" has to be tight or it swallows everything;
// counterparties are 3/6/21/206 at p25/50/75/95, so 10 sits between the median and p75.
export const BALANCED = 0.05, HOARD = 0.5, DRAIN = -0.5, MANY_CP = 10, VENUE_REACH = 3;

export function archetype(p) {
  const r = retention(p), s = skew(p), venues = p.venuesIn + p.venuesOut;
  if (p.kind) return { type: p.kind, why: "hand-labelled in EXCLUDE_LABELS" };
  if (venues >= VENUE_REACH)
    return { type: "exchange-adjacent", why: `touched ${venues} tagged venues` };
  if (Math.abs(r) < BALANCED && p.cp >= MANY_CP)
    return { type: "router", why: `${p.cp} counterparties, kept ${(r*100).toFixed(1)}% of what passed through` };
  if (r >= HOARD)  return { type: "accumulator", why: `kept ${(r*100).toFixed(0)}% of arriving volume` };
  if (r <= DRAIN)  return { type: "drainer", why: `sent out ${(-r*100).toFixed(0)}% more than arrived` };
  if (s >= 0.6)    return { type: "collector", why: `${p.txIn} in vs ${p.txOut} out` };
  if (s <= -0.6)   return { type: "distributor", why: `${p.txOut} out vs ${p.txIn} in` };
  return { type: "two-way", why: `balanced flow across ${p.cp} counterparties` };
}

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : d; };

if (process.argv[1]?.endsWith("build-wallet-archetypes.mjs")) {
  const J = f => JSON.parse(readFileSync(new URL(`../public/${f}`, import.meta.url), "utf8"));
  const sankey = J("cex-sankey.json");
  const profiles = sankey.profiles || [];
  const whales = (J("whales.json").wallets || []);
  const bal = new Map(whales.map(w => [String(w.a||"").toLowerCase(), w.bal]));

  const rows = profiles.map(p => {
    const a = archetype(p);
    return { a: p.a, type: a.type, why: a.why, cp: p.cp, txIn: p.txIn, txOut: p.txOut,
             volIn: p.volIn, volOut: p.volOut, retention: +retention(p).toFixed(3),
             venues: p.venuesIn + p.venuesOut, holds: bal.get(p.a) ?? null };
  }).sort((x, y) => (y.volIn + y.volOut) - (x.volIn + x.volOut));

  const counts = {};
  for (const r of rows) counts[r.type] = (counts[r.type] || 0) + 1;
  const vol = {};
  for (const r of rows) vol[r.type] = (vol[r.type] || 0) + r.volIn + r.volOut;

  writeFileSync(arg("out", new URL("../public/wallet-archetypes.json", import.meta.url).pathname),
    JSON.stringify({ updated: sankey.updated, window: sankey.window, n: rows.length, counts, volume: vol, wallets: rows.slice(0, 250) }));

  const f = n => Math.round(n).toLocaleString();
  console.log(`${rows.length} active wallets, ${sankey.window.days}-day window ending ${sankey.updated}\n`);
  for (const [t, n] of Object.entries(counts).sort((a,b)=>b[1]-a[1]))
    console.log(`  ${t.padEnd(18)} ${String(n).padStart(4)} wallets   ${f(vol[t]).padStart(13)} SPX moved`);
  // whales.json only lists wallets above its own balance bar, so a null `holds` means "not a
  // whale", NOT "holds nothing". Reporting a median over nulls-as-zero would invent a fact.
  const routers = rows.filter(r => r.type === "router");
  const known = routers.filter(r => r.holds != null);
  console.log(`\nrouters: ${routers.length} wallets moved ${f(vol.router||0)} SPX in ${sankey.window.days} days.`);
  console.log(`  ${known.length} of them clear the whale bar at all; the rest hold less than it.`);
  if (known.length) console.log(`  those ${known.length} hold a median of ${f(known.map(r=>r.holds).sort((a,b)=>a-b)[Math.floor(known.length/2)])} SPX`);
  console.log(`\nof 400 ACTIVE wallets, only ${counts.accumulator||0} are net accumulating.`);
}
