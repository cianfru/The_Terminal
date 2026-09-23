// LANDSCAPE PHASE 2 RUNNER — every AEON holder grouped with the wallets it structurally controls.
//   node research/pfp-forensics/landscape/build-households.mjs --ledger=transfers.csv[,tail.csv] \
//        --aeon=public/aeon-onchain.json --addr-types=public/addr-types.json --codecache=codecache.json \
//        --out=households.json
//
// The library is households.mjs; this is the one committed way to run it (it began life as a scratch
// script). Links are found with the structural rules only, then hubs above MAX_HUB are cut before the
// components are taken — a service that touches hundreds of wallets is flagged, never merged.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadLedger } from "./ledger.mjs";
import { makeInfra, households, capHubs, components } from "./households.mjs";

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const L = await loadLedger(arg("ledger").split(","));
const seedTypes = existsSync(arg("addr-types", "")) ? JSON.parse(readFileSync(arg("addr-types"), "utf8")).types || {} : {};
const infra = await makeInfra(arg("codecache", "codecache.json"), seedTypes);
const aeon = new Map(JSON.parse(readFileSync(arg("aeon"), "utf8")).holders.map(h => [h.a.toLowerCase(), h.n]));
const seeds = [...aeon.keys()];

let last = Date.now();
const { links } = await households(L, seeds, infra.isInfra, { onSeed: (i, n) => {
  if (Date.now() - last > 30000) { last = Date.now(); infra.save(); console.error(`  ${i}/${n} seeds · ${infra.fetched()} getCode`); }
} });
infra.save();
const { kept, flagged } = capHubs(links);
const hh = components(seeds, kept).filter(g => g.some(a => aeon.has(a))).map(g => ({
  wallets: g.sort(),
  aeonHolders: g.filter(a => aeon.has(a)),
  aeon: g.reduce((s, a) => s + (aeon.get(a) || 0), 0),
  spx: Math.round(g.reduce((s, a) => s + L.balance(a), 0)),
  spxEver: g.some(a => L.ledger(a).length > 0),
})).sort((a, b) => b.spx - a.spx);

writeFileSync(arg("out"), JSON.stringify({ asOf: new Date(L.latest).toISOString(), households: hh, links: kept, flaggedHubs: flagged }));
console.error(`${seeds.length} AEON holders → ${hh.length} households · ${hh.filter(h => h.spxEver).length} with SPX history · ${kept.length} links kept · ${flagged.length} hubs cut`);
