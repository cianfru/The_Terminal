// DEEDS — the lease that stops a claimed building teleporting overnight.
//
// ⭐⭐ THE PROBLEM THIS FIXES. placeCity() is not a pure function of an address. It fills lots in
// RANK ORDER against a mutable `used` set, so three separate things relocate a building when
// nothing about that wallet changed:
//   • crossing manCap (~1,680) sends a wallet across the river
//   • crossing the top 10% switches its district pool to TOWER_HOODS only
//   • collision probing — a wallet ABOVE you in the sort arriving or leaving can take the lot your
//     stride would have landed on, and you shift
// That was fine while the city was generated. It is not fine once somebody has spent an evening
// building a black-and-gold tower and expects to find it tomorrow.
//
// ⭐⭐ THE MODEL: THREE THINGS, THREE LIFETIMES. The mistake is treating them as one object.
//
//   the BUILDING  lives exactly as long as the wallet meets residency. It is data. It must vanish
//                 when the holdings do, or the city stops being a map.
//   the LOT       is a LEASE. Scarce (1,680 on the island, none spare), tier-gated, reclaimable.
//   the DEED      is the cosmetic identity and the serial number. It belongs to the wallet FOREVER
//                 and is never destroyed — it lives in storage, not in the city.
//
// So "your building collapses and is gone forever" is the wrong story. What happens is that you
// MOVE OUT. The design stays in your pocket. Come back over the bar and you rebuild it exactly, on
// whatever lot your holdings now earn.
//
// ⚠ THIS FILE DOES NOT TOUCH placeCity. The first allocation is SEEDED from placeCity's own output,
// so the day deeds ship, not one building moves. After that the deed file is the authority and the
// placer is only consulted for wallets that do not have one yet.
//
// Pure and I/O-free: scripts/build-city-deeds.mjs does the reading and writing, and the tests drive
// these functions on synthetic populations.

import { tierLadder } from "./city-tiers.js";

/** Schema version of the deed FILE. */
export const DEEDS_VERSION = 1;

// How long a lot is held for a wallet that has fallen below residency. Long enough that a dip, a
// bridge, or a week of paper-handing does not cost somebody their address; short enough that the
// island cannot silently fill with ghosts. The island has ZERO spare lots, so every day of grace is
// a day somebody else waits.
export const GRACE_DAYS = 30;

// A relocation cooldown, so nobody churns lots for entertainment and so the waiting list means
// something. Moving is free; moving often is not.
export const MOVE_COOLDOWN_DAYS = 30;

export const DAY = 864e5;
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const lc = a => String(a || "").toLowerCase();

/** A lot's stable id. Hood + index into that hood's lot array, which is fixed while k is 1. */
export const lotId = (hood, i) => `${hood}#${i}`;
export const lotHood = id => String(id || "").split("#")[0];

// ── the record ────────────────────────────────────────────────────────────────────────────────
// {
//   a:         "0x…"                the wallet
//   lot:       "midtown#412"        the lease, null while the deed is archived
//   tier:      "island"             which ladder rung the lot belongs to
//   serial:    41                   issued once, in claim order, never reused
//   since:     "2026-09-13"         when this wallet first took a lot
//   state:     "occupied"|"vacant"|"archived"
//   vacantAt:  "2026-10-01"|null    when it fell below residency
//   movedAt:   "2026-09-20"|null    last voluntary relocation, for the cooldown
//   moves:     0
// }

const newDeed = (a, lot, tier, serial, today) => ({
  a: lc(a), lot, tier, serial,
  since: today, state: "occupied", vacantAt: null, movedAt: null, moves: 0,
});

// ── seeding ───────────────────────────────────────────────────────────────────────────────────

/**
 * First run: freeze exactly what the city already draws.
 *
 * @param {Array<{a:string, hood:{id:string}|string, x:number, z:number}>} placed  placeCity output,
 *        in rank order, plus a `lotIndex` resolved by the caller (it knows the lot arrays).
 * @param {Map<string,string>} tiers  address -> tier
 * @param {string} today  ISO date
 */
export function seedDeeds(placed, tiers, today) {
  const deeds = {};
  let serial = 0;
  for (const p of placed) {
    const a = lc(p.a);
    if (!a || deeds[a]) continue;
    deeds[a] = newDeed(a, p.lot, tiers.get(a) || "borough", ++serial, today);
  }
  return { v: DEEDS_VERSION, updated: today, nextSerial: serial + 1, deeds };
}

// ── the daily reconcile ───────────────────────────────────────────────────────────────────────

/**
 * Bring a deed file up to date against today's residents.
 *
 * Order matters and is the whole design:
 *   1. depart   — deeds whose wallet is no longer resident go VACANT (lot still held)
 *   2. expire   — vacant past the grace window are ARCHIVED and their lot released
 *   3. return   — vacant wallets that came back are restored to the SAME lot, untouched
 *   4. promote  — residents whose tier changed release their old lot and need a new one
 *   5. house    — everyone with no lot (new arrivals, promotions, returners whose lot expired)
 *                 is given one from the free pool of their tier, in rank order
 *
 * @param {object} file       the existing deed file (or the seed shape)
 * @param {Array<{a:string}>} ranked  today's residents, sorted by conviction score, biggest first
 * @param {object} pools      ELIGIBILITY, not a partition: { prime, island, borough } where each is
 *        every lot that tier may stand on. ⚠ THEY OVERLAP ON PURPOSE — placeCity's tower districts
 *        are tower-ELIGIBLE, not tower-exclusive (`bigT > 0.9` restricts the top 10% TO them, it
 *        does not reserve them), so the island tier's list includes the prime lots. Allocation
 *        therefore goes through one shared `taken` set rather than per-tier arrays; splicing a lot
 *        out of one list while it sits in another is how two wallets end up in one building.
 * @param {string} today      ISO date
 * @param {(a:string, tier:string, free:string[]) => string} choose  which free lot a wallet takes;
 *        the builder passes the SAME salted-hash rule placeCity uses, so an unclaimed building lands
 *        where it always would have.
 */
export function reconcile(file, ranked, pools, today, choose, opts = {}) {
  const grace = opts.graceDays ?? GRACE_DAYS;
  const deeds = { ...(file?.deeds || {}) };
  let nextSerial = file?.nextSerial || 1;

  const resident = new Set(ranked.map(w => lc(w.a)));
  const held = new Map(Object.entries(deeds).filter(([, d]) => d.state !== "archived").map(([a, d]) => [a, d.tier]));
  // ⚠ manCap MUST BE THE NUMBER OF DISTINCT ISLAND LOTS. Summing the tier lists double-counts the
  // prime lots now that `island` includes them, which would quietly widen Manhattan and start
  // handing island tiers to wallets the city puts across the river.
  const manCap = opts.manCap ?? new Set([...(pools.prime || []), ...(pools.island || [])]).size;
  const tiers = tierLadder(ranked, manCap, held);

  const stats = { departed: 0, expired: 0, returned: 0, promoted: 0, demoted: 0, housed: 0, vacant: 0 };
  const taken = new Set();

  // 1 + 2 + 3 — the lifecycle of a deed whose wallet is not on today's list.
  for (const a of Object.keys(deeds)) {
    const d = deeds[a];
    if (resident.has(a)) {
      if (d.state === "vacant") {
        // ⭐ CAME BACK INSIDE THE WINDOW — nothing changes. Same lot, same everything. This is the
        // whole reason the grace window exists, and it is the only branch users will ever notice.
        deeds[a] = { ...d, state: "occupied", vacantAt: null };
        stats.returned++;
      } else if (d.state === "archived") {
        // Back after the lot went. The deed (serial, cosmetics) survived; it just needs housing.
        deeds[a] = { ...d, state: "occupied", vacantAt: null, lot: null };
      }
      continue;
    }
    if (d.state === "archived") continue;
    if (d.state === "occupied") {
      deeds[a] = { ...d, state: "vacant", vacantAt: today };
      stats.departed++;
      continue;
    }
    // already vacant — has it run out of road?
    if (d.vacantAt && days(d.vacantAt, today) >= grace) {
      // ⚠ THE LOT IS RELEASED, THE DEED IS NOT DELETED. Serial, style and colours survive archiving
      // forever; only the lease ends. Coming back years later rebuilds the same building somewhere
      // new, which is both the honest behaviour and the good one.
      deeds[a] = { ...d, state: "archived", lot: null };
      stats.expired++;
    } else stats.vacant++;
  }

  // Lots still spoken for: occupied residents and everyone inside their grace window.
  for (const d of Object.values(deeds)) if (d.lot && d.state !== "archived") taken.add(d.lot);

  // 4 — tier moves. A promotion is the best notification this product can send, so it is applied
  // automatically rather than offered: declining would leave a tier-2 wallet on a tier-3 lot and
  // quietly break the claim that the island holds the top 1,680.
  for (const w of ranked) {
    const a = lc(w.a), d = deeds[a];
    if (!d || d.state === "archived") continue;
    const want = tiers.get(a);
    if (want && d.tier !== want) {
      if (d.lot) taken.delete(d.lot);
      const up = rung(want) < rung(d.tier);
      deeds[a] = { ...d, tier: want, lot: null };
      if (up) stats.promoted++; else stats.demoted++;
    }
  }

  // 5 — house everyone without a lot, in rank order so the biggest get first refusal on a tier's
  // remaining lots. Within a tier the CHOICE is the caller's hash rule, not this order, so the
  // layout of unclaimed buildings stays exactly what placeCity would have produced.
  // The live free list is derived from `taken` at the moment of each assignment, not cached per
  // tier — see the overlap note on `pools`. Step 5 only runs for wallets WITHOUT a lot (new
  // arrivals and tier moves), which on a steady-state day is a handful, so this stays cheap.
  const freeIn = tier => (pools[tier] || []).filter(id => !taken.has(id));
  for (const w of ranked) {
    const a = lc(w.a);
    // ⚠ A RESIDENT WITH NO DEED IS THE COMMON CASE, NOT AN EDGE ONE — every new arrival is one, and
    // so is every wallet on the very first reconcile of an empty registry. Skipping them (which an
    // earlier cut of this loop did, by testing `!d`) quietly left the whole city unhoused.
    let d = deeds[a];
    // ⭐ THE SERIAL IS ISSUED WITH THE DEED, NOT WITH THE LOT. A wallet waiting for its tier to free
    // up still holds Deed No. 41 — the number is the owner's identity in the registry, and tying it
    // to housing would hand out 0 to everyone in the queue and renumber them later.
    if (!d) d = deeds[a] = newDeed(a, null, tiers.get(a) || "borough", nextSerial++, today);
    if (d.lot) continue;
    if (d.state === "archived") { d = deeds[a] = { ...d, state: "occupied", vacantAt: null }; }
    const pool = freeIn(d.tier);
    if (!pool.length) {
      // ⚠ A TIER CAN RUN OUT. The island is full by construction, so a promotion can arrive with
      // nowhere to put it. Rather than invent a lot on the water, the wallet keeps its tier and
      // waits — it is housed on the next run when a departure frees something. The builder reports
      // this so it never happens silently.
      continue;
    }
    const wanted = choose(a, d.tier, pool);
    const id = pool.includes(wanted) ? wanted : pool[0];
    taken.add(id);
    deeds[a] = { ...d, lot: id, serial: d.serial || nextSerial++ };
    stats.housed++;
  }

  return { v: DEEDS_VERSION, updated: today, nextSerial, deeds, stats };
}

const rung = t => (t === "prime" ? 0 : t === "island" ? 1 : 2);

// ── relocation ────────────────────────────────────────────────────────────────────────────────

/**
 * Move a wallet to a different lot INSIDE ITS OWN TIER.
 *
 * ⭐ WHY THIS IS ALLOWED AT ALL. Which Manhattan district you land in is already a coin flip —
 * neighbourhoodFor() picks it from hash01(address) weighted by lot count, and your lot inside it
 * from a second salted hash. SoHo versus Harlem versus Inwood carries ZERO information today, so
 * letting an owner choose costs the city nothing it was actually saying.
 *
 * ⚠ AND WHY ONLY INSIDE A TIER. The tier boundary is the one place location carries data. Crossing
 * it is earned on-chain and by nothing else — that is the line between hold-to-win and pay-to-win,
 * and it is not negotiable.
 *
 * @returns {{ok:true, file:object} | {ok:false, err:string}}
 */
export function relocate(file, a, toLot, pools, today, opts = {}) {
  const cd = opts.cooldownDays ?? MOVE_COOLDOWN_DAYS;
  const addr = lc(a);
  const deeds = { ...(file?.deeds || {}) };
  const d = deeds[addr];
  if (!d) return { ok: false, err: "no deed for this wallet" };
  if (d.state !== "occupied") return { ok: false, err: "the building is not currently standing" };
  // ⚠ THE TARGET IS CHECKED BEFORE THE COOLDOWN, DELIBERATELY. Telling somebody to wait 30 days for
  // a move that was never going to be allowed is the worse of the two errors — they would spend the
  // wait believing the lot was theirs to take.
  const pool = pools[d.tier] || [];
  if (!pool.includes(toLot)) return { ok: false, err: "that lot is not in your tier" };
  for (const other of Object.values(deeds)) {
    if (other.a !== addr && other.lot === toLot && other.state !== "archived") {
      return { ok: false, err: "that lot is taken" };
    }
  }
  if (d.movedAt && days(d.movedAt, today) < cd) {
    return { ok: false, err: `moved ${days(d.movedAt, today)} days ago — ${cd - days(d.movedAt, today)} to go` };
  }
  deeds[addr] = { ...d, lot: toLot, movedAt: today, moves: (d.moves || 0) + 1 };
  return { ok: true, file: { ...file, deeds, updated: today } };
}

/** Free lots in a tier, for the editor's "where can I move" list. */
export function vacancies(file, pools, tier) {
  const taken = new Set(Object.values(file?.deeds || {}).filter(d => d.state !== "archived" && d.lot).map(d => d.lot));
  return (pools[tier] || []).filter(id => !taken.has(id));
}

// ── reading ───────────────────────────────────────────────────────────────────────────────────

/** The lifecycle state a renderer should draw. */
export function buildingState(deed, isResident, today) {
  if (!deed || deed.state === "archived" || !deed.lot) return "none";
  if (isResident) return "occupied";
  const age = deed.vacantAt ? days(deed.vacantAt, today) : 0;
  return age >= GRACE_DAYS ? "none" : "vacant";
}

/** Days of grace left, for the card's "your lot is held until…" line. */
export const graceLeft = (deed, today, grace = GRACE_DAYS) =>
  (deed?.vacantAt ? Math.max(0, grace - days(deed.vacantAt, today)) : grace);

/** address -> lot, for the placer. Archived and expired deeds are absent, so they fall through. */
export function lotMap(file) {
  const m = new Map();
  for (const [a, d] of Object.entries(file?.deeds || {})) {
    if (d.state !== "archived" && d.lot) m.set(a, d.lot);
  }
  return m;
}

/**
 * Place towers from deeds, falling back to whatever the existing placer produces for anyone
 * without one. Deliberately a SEPARATE function rather than a change to placeCity: the generated
 * city keeps working untouched, and wiring this in later is a one-line swap at the call site.
 */
export function placeFromDeeds(items, file, lotXY, fallback) {
  const lots = lotMap(file);
  const missing = [];
  const out = items.map(it => {
    const id = lots.get(lc(it.a));
    const p = id ? lotXY(id) : null;
    if (!p) { missing.push(it); return null; }
    return { ...it, x: p.x, z: p.z, hood: p.hood, lot: id };
  });
  if (missing.length) {
    const placed = fallback(missing);
    let k = 0;
    for (let i = 0; i < out.length; i++) if (out[i] === null) out[i] = placed[k++];
  }
  return out;
}

export { iso, days };
