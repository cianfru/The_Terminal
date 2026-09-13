// BUILD public/city-deeds.json — the city's land registry.
//
//   node scripts/build-city-deeds.mjs                      # reconcile against today's residents
//   node scripts/build-city-deeds.mjs --seed               # first run: freeze the current layout
//   node scripts/build-city-deeds.mjs --today=2026-10-01   # for testing the grace window
//
// Runs as a step in the daily snapshot, AFTER whales.json is rebuilt. It is the only writer of the
// deed file, and it is deterministic: same residents + same previous file = same output.
//
// ⭐ THE SEED RUN IS THE IMPORTANT ONE. It takes placeCity's own output and freezes it, so the day
// deeds ship not one building moves. Every run after that keeps a wallet on its lot come what may.
//
// ⚠ THIS IS THE SPX CITY'S REGISTRY, AT k = 1. cityScale caps k at 1 for any population over 1,450,
// and the SPX city has ~4,800 residents, so the lot grid is fixed and a lot INDEX is stable. The
// AEON and BOTH modes scale differently (BOTH has ~346 residents, k ~= 0.49) and get a different
// grid — they are NOT covered by this file and keep using placeCity as they do today.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { NEIGHBOURHOODS, hoodLots, boroughLots, cityScale, placeCity, hash01 } from "../src/city-map.js";
import { tierLadder } from "../src/city-tiers.js";
import { seedDeeds, reconcile, lotId } from "../src/city-deeds.js";

const arg = k => { const a = process.argv.find(x => x.startsWith(k)); return a ? a.slice(k.length) : null; };
const SEED = process.argv.includes("--seed");
const OUT = arg("--out=") || "public/city-deeds.json";
const TODAY = arg("--today=") || new Date().toISOString().slice(0, 10);

// ── residents, ranked exactly the way the city ranks them ─────────────────────────────────────
// Must match SpxCity.jsx's `liveTowers`: residency is res !== false, and the conviction score is
// balance weighted by tenure. If these ever diverge the deed file starts disagreeing with the city
// about who is on the island, which is the one thing it exists to prevent.
function residents(file = "public/whales.json") {
  const W = JSON.parse(readFileSync(file, "utf8")).wallets.filter(w => w.res !== false && w.a);
  const maxBal = Math.max(...W.map(w => w.bal), 1);
  const maxDays = Math.max(...W.map(w => w.days || 0), 1);
  return W
    .map(w => ({ ...w, a: w.a.toLowerCase(), score: (w.bal / maxBal) * (0.45 + 0.55 * ((w.days || 0) / maxDays)) }))
    .sort((a, b) => b.score - a.score);
}

// ── the lot pools ─────────────────────────────────────────────────────────────────────────────
// ELIGIBILITY per tier, and they OVERLAP on purpose. placeCity restricts the top 10% TO the tower
// districts (`bigT > 0.9`); it does not reserve those districts for them — an ordinary island wallet
// can land in Midtown by hash, and ~229 of them currently do. So `island` is the whole island, tower
// lots included, and `prime` is the subset the top 10% are confined to. Mirroring the placer here is
// what stops the deed registry slowly draining tower districts of everyone but the top 10%.
function lotPools(k) {
  const prime = [], island = [], borough = [];
  const xy = new Map();
  for (const h of NEIGHBOURHOODS) {
    const lots = hoodLots(h, k);
    const tower = !!(h.towers || h.prime);
    lots.forEach((l, i) => {
      const id = lotId(h.id, i);
      if (tower) prime.push(id);
      island.push(id);                       // the island tier may stand anywhere on the island
      xy.set(id, { x: l.x, z: l.z, hood: h });
    });
  }
  boroughLots(k).forEach((l, i) => {
    const id = lotId(l.hood || "borough", i);
    borough.push(id);
    xy.set(id, { x: l.x, z: l.z, hood: l.hood });
  });
  // manCap is the number of DISTINCT island lots — `island` already is that set, since prime is a
  // subset of it. Passing it explicitly keeps reconcile from having to guess.
  return { pools: { prime, island, borough }, xy, manCap: island.length };
}

// ⭐ THE SAME SALTED HASH placeCity USES — `hash01(address + "|lot")`, deliberately a DIFFERENT salt
// from the one that picks a district. city-map.js explains why at length: reusing the district hash
// for the lot index piles every wallet in a district into the same narrow strip of its lot list,
// because the district was chosen by comparing that very number against cumulative weights.
//
// The placer then probes by a co-prime stride on collision; here `free` already contains only
// unoccupied lots, so the first probe always lands and no stride is needed. The result is the same
// scattered distribution, which is what keeps an unclaimed building where the generated city had it.
const choose = (a, tier, free) =>
  (free.length ? free[Math.floor(hash01(a + "|lot") * free.length) % free.length] : null);

// ── main ──────────────────────────────────────────────────────────────────────────────────────
const R = residents();
const k = cityScale(R.length);
const { pools, xy, manCap } = lotPools(k);

console.error(`city-deeds: ${R.length} residents · k=${k} · lots ${manCap} island (${pools.prime.length} of them tower-district) / ${pools.borough.length} borough`);

let file = existsSync(OUT) && !SEED ? JSON.parse(readFileSync(OUT, "utf8")) : null;

if (!file) {
  // SEED — freeze what placeCity already draws. We ask the placer for its layout, then translate
  // each (x, z) back into the lot id nearest it. Matching by position rather than re-deriving the
  // lot keeps this honest even if the placer's internals change: whatever it drew is what we record.
  const placed = placeCity(R, k);
  const byHood = new Map();
  for (const [id, p] of xy) {
    const h = typeof p.hood === "string" ? p.hood : p.hood?.id;
    if (!byHood.has(h)) byHood.set(h, []);
    byHood.get(h).push({ id, x: p.x, z: p.z });
  }
  const used = new Set();
  const rows = placed.map(p => {
    const h = typeof p.hood === "string" ? p.hood : p.hood?.id;
    const cands = byHood.get(h) || [];
    let best = null, bd = Infinity;
    for (const c of cands) {
      if (used.has(c.id)) continue;
      const d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    if (best) used.add(best.id);
    return { a: p.a, lot: best?.id ?? null };
  }).filter(r => r.lot);
  const tiers = tierLadder(R, manCap, null);
  file = seedDeeds(rows, tiers, TODAY);
  console.error(`city-deeds: SEEDED ${Object.keys(file.deeds).length} deeds from the current layout`);
} else {
  const before = Object.keys(file.deeds || {}).length;
  file = reconcile(file, R, pools, TODAY, choose, { manCap });
  const s = file.stats;
  console.error(`city-deeds: reconciled ${before} -> ${Object.keys(file.deeds).length} deeds · ` +
    `departed ${s.departed} · vacant ${s.vacant} · expired ${s.expired} · returned ${s.returned} · ` +
    `promoted ${s.promoted} · demoted ${s.demoted} · housed ${s.housed}`);
  const homeless = R.filter(w => !file.deeds[w.a]?.lot).length;
  if (homeless) console.error(`city-deeds: ⚠ ${homeless} residents waiting for a lot — their tier is full`);
}

// A sanity gate, because a deed file that hands one lot to two wallets is worse than no deed file.
const seen = new Map();
for (const [a, d] of Object.entries(file.deeds)) {
  if (!d.lot || d.state === "archived") continue;
  if (seen.has(d.lot)) { console.error(`city-deeds: FATAL duplicate lot ${d.lot} (${a} and ${seen.get(d.lot)})`); process.exit(1); }
  seen.set(d.lot, a);
}

writeFileSync(OUT, JSON.stringify(file));
console.error(`city-deeds: wrote ${OUT} (${Object.keys(file.deeds).length} deeds, ${seen.size} lots leased)`);
