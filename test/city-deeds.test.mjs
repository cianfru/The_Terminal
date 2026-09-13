import test from "node:test";
import assert from "node:assert/strict";
import { tierOf, tierLadder, bandOf, BANDS, envelopeOf, PRIME_SHARE, ENTER, LEAVE } from "../src/city-tiers.js";
import { seedDeeds, reconcile, relocate, vacancies, buildingState, lotMap, placeFromDeeds,
         lotId, GRACE_DAYS, MOVE_COOLDOWN_DAYS } from "../src/city-deeds.js";
import { resolve, baseIdentity, validateCustom, prepareCustom, optionsFor, LIGHTS } from "../src/city-identity.js";
import { STYLES, STYLE_BY_ID, stylesFor, variantCount, formIndex, crownsFor, PALETTES, WINDOWS } from "../src/city-styles.js";
import { BAND_IDS } from "../src/city-tiers.js";

// The deed layer exists to make two promises that nothing in the DATA will complain about if they
// break: a claimed building stays on its lot, and a saved customization can never change a number
// that came off the chain. Only a test will notice either one failing, so these are the guard rails.

const addr = i => "0x" + String(i).padStart(40, "0");
const pop = n => Array.from({ length: n }, (_, i) => ({ a: addr(i), score: n - i }));
const pools = (p, isl, b) => ({
  prime: Array.from({ length: p }, (_, i) => lotId("midtown", i)),
  island: Array.from({ length: isl }, (_, i) => lotId("harlem", i)),
  borough: Array.from({ length: b }, (_, i) => lotId("brooklyn", i)),
});
// The builder passes placeCity's salted hash; the tests only need determinism, so first-free is fine.
const firstFree = (a, tier, free) => free[0];
// Seed the way the builder does: each wallet takes a lot FROM ITS OWN TIER'S POOL, so the registry
// starts internally consistent. (A seed that hands island lots to borough wallets is not a scenario
// the allocator has to survive — the builder derives both from the same ladder.)
const seedFrom = (ranked, P, today = "2026-01-01") => {
  const tiers = tierLadder(ranked, P.prime.length + P.island.length, null);
  const next = { prime: 0, island: 0, borough: 0 };
  const rows = [];
  for (const w of ranked) {
    const t = tiers.get(w.a);
    const lot = P[t][next[t]++];
    if (lot) rows.push({ a: w.a, lot });
  }
  // Seed, then reconcile once on the same day — exactly the builder's sequence. A tier can be
  // narrower than the cohort the ladder routes into it, and the reconcile is what houses the
  // remainder, so seeding alone is never the finished registry.
  return reconcile(seedDeeds(rows, tiers, today), ranked, P, today, firstFree);
};

// ── tiers ─────────────────────────────────────────────────────────────────────────────────────

test("tiers are ordered and exhaustive", () => {
  const n = 1000, manCap = 300;
  const seen = new Set();
  let last = 0;
  for (let r = 0; r < n; r++) {
    const t = tierOf(r, n, manCap);
    seen.add(t);
    const rung = t === "prime" ? 0 : t === "island" ? 1 : 2;
    assert.ok(rung >= last, `tier went backwards at rank ${r}`);
    last = rung;
  }
  assert.deepEqual([...seen].sort(), ["borough", "island", "prime"]);
});

test("prime is the top 10% — the same cohort placeCity restricts to TOWER_HOODS", () => {
  const n = 4827, manCap = 1680;
  const cut = Math.floor(PRIME_SHARE * (n - 1));
  assert.equal(tierOf(0, n, manCap), "prime");
  assert.equal(tierOf(Math.floor(cut * ENTER) - 1, n, manCap), "prime");
  assert.equal(tierOf(cut, n, manCap), "island");
  assert.equal(tierOf(manCap, n, manCap), "borough");
});

test("hysteresis keeps a boundary wallet still instead of bouncing across the river", () => {
  const n = 4827, manCap = 1680;
  // A rank inside the gap: past the strict entry bound, short of the exit bound.
  const inGap = Math.floor(manCap * (ENTER + LEAVE) / 2);
  assert.equal(tierOf(inGap, n, manCap, "island"), "island", "an incumbent keeps the island");
  assert.equal(tierOf(inGap, n, manCap, null), "borough", "a newcomer is not admitted on a soft rank");
  assert.equal(tierOf(inGap, n, manCap, "borough"), "borough");
  // And it genuinely cannot oscillate: the wallet has to move ~12% of capacity to change tier.
  const outBound = Math.ceil(manCap * LEAVE);
  assert.equal(tierOf(outBound, n, manCap, "island"), "borough");
  assert.ok(outBound - Math.floor(manCap * ENTER) > manCap * 0.1);
});

test("a demotion from prime lands on the island, never in a borough", () => {
  const n = 1000, manCap = 400;
  assert.equal(tierOf(120, n, manCap, "prime"), "island");
});

// ── bands ─────────────────────────────────────────────────────────────────────────────────────

test("bands reproduce archetype()'s own 3.5 / 6 / 11 thresholds", () => {
  assert.equal(bandOf(1.0), "lowrise");
  assert.equal(bandOf(3.49), "lowrise");
  assert.equal(bandOf(3.5), "midrise");
  assert.equal(bandOf(5.99), "midrise");
  assert.equal(bandOf(6), "tower");
  assert.equal(bandOf(10.99), "tower");
  assert.equal(bandOf(11), "supertall");
  assert.equal(bandOf(21), "supertall");
  assert.equal(bandOf(NaN), "lowrise", "a degenerate height must not return undefined");
  // The bands must tile the range with no gap and no overlap, or a height falls through.
  for (let i = 1; i < BANDS.length; i++) assert.equal(BANDS[i].min, BANDS[i - 1].max);
});

// ── the style registry ────────────────────────────────────────────────────────────────────────

test("every style declares at least one band, and every band has real choice", () => {
  for (const s of STYLES) {
    assert.ok(Array.isArray(s.bands) && s.bands.length, `${s.id} has no bands`);
    for (const b of s.bands) {
      assert.ok(BAND_IDS.includes(b), `${s.id} declares unknown band ${b}`);
      assert.ok(variantCount(s.id, b) > 0, `${s.id} declares band ${b} but ships no forms for it`);
    }
  }
  for (const b of BAND_IDS) {
    assert.ok(stylesFor(b).length >= 3, `band ${b} offers only ${stylesFor(b).length} styles — not a choice`);
  }
});

test("a style's palettes, crowns and forms all resolve", () => {
  for (const s of STYLES) {
    for (const p of s.palettes) assert.ok(PALETTES[p], `${s.id} names unknown palette ${p}`);
    for (const b of s.bands) {
      assert.ok(crownsFor(s.id, b).length, `${s.id}/${b} has no crown`);
      assert.equal(typeof formIndex(s.id, b, 0), "number");
      // Variant wraps rather than falling off the end.
      assert.equal(formIndex(s.id, b, 99), formIndex(s.id, b, 99 % variantCount(s.id, b)));
    }
  }
});

test("low-rise cannot wear a supertall silhouette, and every band can be beautiful", () => {
  const low = stylesFor("lowrise").map(s => s.id);
  assert.ok(!low.includes("glass_supertall"), "a townhouse envelope must not offer Glass Supertall");
  assert.ok(low.includes("futuristic"), "a small holder must still be able to build something striking");
});

// ── the resolver: the guarantee that matters ──────────────────────────────────────────────────

const env = (over = {}) => envelopeOf({
  a: addr(7), rank: 500, n: 4827, manCap: 1680, height: 7.5, lot: "harlem#12", hood: "harlem", ...over,
});

test("an unclaimed building is byte-identical to its deterministic default", () => {
  const e = env();
  const a = resolve(e, null), b = resolve(e, undefined), c = resolve(e, {});
  const base = baseIdentity(e);
  for (const k of ["style", "variant", "palette", "windows", "crown"]) {
    assert.equal(a[k], base[k]);
    assert.equal(b[k], base[k]);
    assert.equal(c[k], base[k], `an empty custom changed ${k}`);
  }
  assert.equal(a.claimed, false);
  assert.equal(c.claimed, true, "an empty object is still a claim, it just changes nothing");
});

test("NO customization can move a plot, change a height, or promote a tier", () => {
  const e = env();
  // Everything a hostile save could try, at once.
  const hostile = {
    style: "art_deco",
    height: 21, h: 21, scale: 99, y: 50,
    lot: "midtown#0", hood: "midtown", x: 0, z: 0,
    tier: "prime", rank: 0, band: "supertall", landmark: 0,
    width: 9, depth: 9, a: addr(999), score: 1e9,
  };
  const r = resolve(e, hostile);
  assert.equal(r.height, e.height);
  assert.equal(r.lot, e.lot);
  assert.equal(r.hood, e.hood);
  assert.equal(r.tier, e.tier);
  assert.equal(r.rank, e.rank);
  assert.equal(r.band, e.band);
  assert.equal(r.width, e.width);
  assert.equal(r.depth, e.depth);
  assert.equal(r.a, e.a);
  assert.equal(r.landmark, e.landmark);
  // …and the one thing it WAS allowed to do did happen.
  assert.equal(r.style, "art_deco");
});

test("a style outside the envelope's band falls back rather than throwing", () => {
  const low = env({ height: 2 });                       // lowrise
  const r = resolve(low, { style: "glass_supertall" });
  assert.notEqual(r.style, "glass_supertall");
  assert.ok(r.repaired.length, "the fallback must be reported, not silent");
  assert.ok(stylesFor("lowrise").some(s => s.id === r.style));
});

test("growing across a band keeps the style when the registry can build it there", () => {
  // Art Deco spans midrise -> supertall, so a wallet that grows keeps its identity.
  const mid = env({ height: 5 }), tall = env({ height: 15 });
  assert.equal(resolve(mid, { style: "art_deco" }).style, "art_deco");
  const grown = resolve(tall, { style: "art_deco", palette: "ink" });
  assert.equal(grown.style, "art_deco");
  assert.equal(grown.palette, "ink", "colours must survive the growth");
  assert.equal(grown.band, "supertall");
  assert.notEqual(grown.form, resolve(mid, { style: "art_deco" }).form, "the FORM follows the data");
});

test("accent light never touches the window channel", () => {
  assert.ok(!LIGHTS.includes("windows"));
  const r = resolve(env(), { light: "ground_wash" });
  assert.equal(r.light, "ground_wash");
  assert.equal(resolve(env(), { light: "chartreuse_beam" }).light, "none", "unknown lights are dropped");
});

test("decorations are clamped into normalised face space", () => {
  const e = env();
  const r = resolve(e, { decor: [
    { a: "spx6900", face: "n", u: 0.42, v: 0.78, s: 1.1 },
    { a: "evil", face: "underground", u: 5, v: -2 },          // dropped: bad face
    { a: "ok2", face: "roof", u: 0.1, v: 0.1 },
    { a: "ok3", face: "s", u: 0.2, v: 0.2 },                  // dropped: over the cap
  ] });
  assert.equal(r.decor.length, 2);
  assert.equal(r.decor[0].u, 0.42);
  assert.ok(r.decor.every(d => d.u >= 0 && d.u <= 1 && d.v >= 0 && d.v <= 1));
  assert.ok(!r.decor.some(d => d.face === "underground"));
});

test("validateCustom names the problem instead of silently repairing", () => {
  const e = env({ height: 2 });
  assert.deepEqual(validateCustom({ style: "art_deco", palette: "ink" }, env({ height: 15 })), []);
  assert.ok(validateCustom({ style: "glass_supertall" }, e)[0].includes("not buildable"));
  assert.ok(validateCustom({ nope: 1 }, e)[0].includes("unknown key"));
  assert.ok(validateCustom({ decor: [{ a: "x", face: "n", u: 2, v: 0 }] }, e).length);
  assert.throws(() => prepareCustom({ style: "glass_supertall" }, e), /not buildable/);
});

test("prepareCustom stamps a version and bumps the revision", () => {
  const e = env({ height: 15 });
  const rec = prepareCustom({ style: "art_deco", palette: "ink" }, e, { rev: 6, by: "u1" });
  assert.equal(rec.v, 1);
  assert.equal(rec.rev, 7);
  assert.equal(rec.a, e.a);
  assert.equal(rec.by, "u1");
  assert.ok(!("height" in rec) && !("lot" in rec), "storage must not carry envelope keys at all");
});

test("optionsFor only ever offers what the envelope can build", () => {
  for (const h of [1.5, 4, 8, 16]) {
    const e = env({ height: h }), o = optionsFor(e);
    assert.equal(o.band, bandOf(h));
    assert.ok(o.styles.length >= 3);
    for (const s of o.styles) {
      assert.ok(STYLE_BY_ID[s.id].bands.includes(o.band));
      assert.ok(s.variants > 0);
      assert.deepEqual(validateCustom({ style: s.id, crown: s.crowns[0], palette: s.palettes[0] }, e), []);
    }
    for (const r of o.roof) assert.ok(BAND_IDS.indexOf(r.minBand) <= BAND_IDS.indexOf(o.band));
  }
});

// ── the deed lifecycle ────────────────────────────────────────────────────────────────────────

test("a resident keeps its lot when the population changes around it", () => {
  const P = pools(10, 40, 200);
  const R = pop(120);
  let file = seedFrom(R, P);
  const mine = R[60].a, lot = file.deeds[mine].lot;
  // Fifty new wallets arrive above it and twenty below it leave.
  const R2 = [...pop(50).map((w, i) => ({ a: addr(1000 + i), score: 1e6 - i })), ...R.slice(0, 100)];
  file = reconcile(file, R2, P, "2026-01-02", firstFree);
  assert.equal(file.deeds[mine].lot, lot, "the lot moved when nothing about this wallet changed");
});

test("no two live deeds ever share a lot", () => {
  const P = pools(5, 20, 60);
  let file = seedFrom(pop(70), P);
  for (let day = 2; day <= 12; day++) {
    // churn: a different slice of the population each day
    const R = pop(85).filter((_, i) => (i + day) % 7 !== 0);
    file = reconcile(file, R, P, `2026-01-${String(day).padStart(2, "0")}`, firstFree);
    const seen = new Set();
    for (const d of Object.values(file.deeds)) {
      if (!d.lot || d.state === "archived") continue;
      assert.ok(!seen.has(d.lot), `duplicate lot ${d.lot} on day ${day}`);
      seen.add(d.lot);
    }
  }
});

test("departure goes VACANT holding the lot, then expires and releases it", () => {
  const P = pools(2, 8, 14);
  let file = seedFrom(pop(12), P);
  // Pick a wallet that actually got housed — a tier can be narrower than its cohort, so which
  // index holds a lot is an allocator detail this test has no business asserting.
  const gone = Object.keys(file.deeds).find(a => file.deeds[a].lot);
  const lot = file.deeds[gone].lot;
  const stay = pop(12).filter(w => w.a !== gone);

  file = reconcile(file, stay, P, "2026-01-02", firstFree);
  assert.equal(file.deeds[gone].state, "vacant");
  assert.equal(file.deeds[gone].lot, lot, "the lot is HELD during grace, not released");
  assert.equal(buildingState(file.deeds[gone], false, "2026-01-02"), "vacant");

  // Inside the window nobody else can be given it.
  assert.ok(!vacancies(file, P, file.deeds[gone].tier).includes(lot));

  // Past the window it is archived and the lot is free.
  const later = "2026-03-01";
  file = reconcile(file, stay, P, later, firstFree);
  assert.equal(file.deeds[gone].state, "archived");
  assert.equal(file.deeds[gone].lot, null);
  assert.equal(buildingState(file.deeds[gone], false, later), "none");
  assert.ok(vacancies(file, P, "prime").concat(vacancies(file, P, "island"), vacancies(file, P, "borough")).includes(lot));
});

test("coming back inside the grace window restores the exact same lot", () => {
  const P = pools(2, 8, 14);
  let file = seedFrom(pop(12), P);
  const away = Object.keys(file.deeds).find(a => file.deeds[a].lot);
  const lot = file.deeds[away].lot, serial = file.deeds[away].serial;
  file = reconcile(file, pop(12).filter(w => w.a !== away), P, "2026-01-05", firstFree);
  assert.equal(file.deeds[away].state, "vacant");
  file = reconcile(file, pop(12), P, "2026-01-20", firstFree);
  assert.equal(file.deeds[away].state, "occupied");
  assert.equal(file.deeds[away].lot, lot);
  assert.equal(file.deeds[away].serial, serial, "the serial number is for life");
  assert.ok(GRACE_DAYS >= 15);
});

test("the deed outlives the lease — an archived wallet keeps its serial and rebuilds later", () => {
  const P = pools(2, 8, 14);
  let file = seedFrom(pop(12), P);
  const away = Object.keys(file.deeds).find(a => file.deeds[a].lot);
  const serial = file.deeds[away].serial;
  const without = pop(12).filter(w => w.a !== away);
  file = reconcile(file, without, P, "2026-01-02", firstFree);
  file = reconcile(file, without, P, "2026-06-01", firstFree);
  assert.equal(file.deeds[away].state, "archived");
  file = reconcile(file, pop(12), P, "2026-06-02", firstFree);
  assert.equal(file.deeds[away].state, "occupied");
  assert.ok(file.deeds[away].lot, "a returning wallet is re-housed");
  assert.equal(file.deeds[away].serial, serial, "the serial survived the whole round trip");
});

test("a promotion moves the lot and frees the old one", () => {
  const P = pools(3, 6, 30);
  let file = seedFrom(pop(30), P);
  const climber = addr(25);
  const old = file.deeds[climber].lot;
  assert.equal(file.deeds[climber].tier, "borough");
  // It becomes the biggest wallet in the city.
  const R2 = [{ a: climber, score: 1e9 }, ...pop(30).filter(w => w.a !== climber)];
  file = reconcile(file, R2, P, "2026-02-01", firstFree);
  assert.equal(file.deeds[climber].tier, "prime");
  assert.notEqual(file.deeds[climber].lot, old);
  assert.ok(P.prime.includes(file.deeds[climber].lot));
  assert.ok(file.stats.promoted >= 1);
});

test("a full tier parks the wallet rather than inventing a lot", () => {
  const P = pools(1, 1, 1);            // three lots, ten residents
  let file = reconcile({ v: 1, nextSerial: 1, deeds: {} }, pop(10), P, "2026-01-01", firstFree);
  const housed = Object.values(file.deeds).filter(d => d.lot).length;
  assert.equal(housed, 3, "exactly the lots that exist are leased");
  assert.ok(Object.values(file.deeds).every(d => !d.lot || [...P.prime, ...P.island, ...P.borough].includes(d.lot)));
});

// ── relocation ────────────────────────────────────────────────────────────────────────────────

test("relocation works inside a tier and is refused across one", () => {
  const P = pools(4, 10, 40);
  let file = seedFrom(pop(20), P);
  const me = Object.entries(file.deeds).find(([, d]) => d.tier === "borough")[0];
  const free = vacancies(file, P, "borough");
  assert.ok(free.length, "the boroughs have spare lots — that is the point");

  const ok = relocate(file, me, free[0], P, "2026-02-01");
  assert.equal(ok.ok, true);
  assert.equal(ok.file.deeds[me].lot, free[0]);
  assert.equal(ok.file.deeds[me].moves, 1);

  // Across a tier: refused, whatever the lot.
  const up = relocate(ok.file, me, P.prime[0], P, "2026-02-01");
  assert.equal(up.ok, false);
  assert.match(up.err, /not in your tier/);
});

test("relocation refuses an occupied lot and honours the cooldown", () => {
  const P = pools(4, 10, 40);
  let file = seedFrom(pop(20), P);
  const [me, mine] = Object.entries(file.deeds).find(([, d]) => d.tier === "borough");
  const other = Object.entries(file.deeds).find(([a, d]) => a !== me && d.tier === "borough")[1];
  assert.equal(relocate(file, me, other.lot, P, "2026-02-01").ok, false, "took an occupied lot");

  const free = vacancies(file, P, "borough");
  const moved = relocate(file, me, free[0], P, "2026-02-01");
  const again = relocate(moved.file, me, free[1], P, "2026-02-05");
  assert.equal(again.ok, false);
  assert.match(again.err, /to go/);
  const late = relocate(moved.file, me, free[1], P, "2026-04-01");
  assert.equal(late.ok, true, `a move must be possible again after ${MOVE_COOLDOWN_DAYS} days`);
  assert.ok(mine);
});

test("a vacant building cannot be relocated", () => {
  const P = pools(2, 8, 14);
  let file = seedFrom(pop(12), P);
  const gone = addr(5);
  file = reconcile(file, pop(12).filter(w => w.a !== gone), P, "2026-01-02", firstFree);
  const r = relocate(file, gone, vacancies(file, P, file.deeds[gone].tier)[0], P, "2026-01-03");
  assert.equal(r.ok, false);
});

// ── wiring ────────────────────────────────────────────────────────────────────────────────────

test("placeFromDeeds uses the deed and falls back for anyone without one", () => {
  const P = pools(2, 8, 14);
  const file = seedFrom(pop(12), P);
  const xy = id => ({ x: id.length, z: id.charCodeAt(0), hood: id.split("#")[0] });
  const items = [{ a: addr(3) }, { a: addr(999) }, { a: addr(4) }];
  const out = placeFromDeeds(items, file, xy, miss => miss.map(m => ({ ...m, x: -1, z: -1, hood: "fallback" })));
  assert.equal(out.length, 3);
  assert.equal(out[0].lot, file.deeds[addr(3)].lot);
  assert.equal(out[1].hood, "fallback", "an unknown wallet falls through to the placer");
  assert.equal(out[2].lot, file.deeds[addr(4)].lot);
  assert.equal(lotMap(file).get(addr(3)), file.deeds[addr(3)].lot);
});

test("seeding is stable — the same input twice is the same registry", () => {
  const P = pools(4, 12, 30);
  const R = pop(25);
  const a = seedFrom(R, P), b = seedFrom(R, P);
  assert.deepEqual(a.deeds, b.deeds);
  assert.equal(Object.keys(a.deeds).length, 25);
  // serials are dense and start at 1
  const serials = Object.values(a.deeds).map(d => d.serial).sort((x, y) => x - y);
  assert.deepEqual(serials, Array.from({ length: 25 }, (_, i) => i + 1));
});

test("windows and crowns are real values, not free strings", () => {
  const e = env();
  assert.ok(WINDOWS.includes(resolve(e, { windows: "smoked" }).windows));
  assert.equal(resolve(e, { windows: "neon-pink" }).windows, baseIdentity(e).windows);
});
