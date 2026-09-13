// WHERE A WALLET STANDS, AND WHAT IT MAY BUILD THERE.
//
// The city has always encoded two facts in geography, and never said so out loud:
//   • which side of the river you are on  — the top `manCap` wallets by CONVICTION fill Manhattan's
//     1,680 lots, everyone else goes to the boroughs (placeCity slices `items` at manCap)
//   • whether you may stand in a tower district — the top 10% are restricted to TOWER_HOODS
//     (placeCity's `bigT > 0.9` rule)
// Everything else about location is a coin flip: which Manhattan district you land in comes from
// hash01(address) weighted by lot count, and your lot within it from a second salted hash. That
// asymmetry is the whole basis of the customization layer — a TIER carries data and must be earned,
// a DISTRICT carries nothing and can therefore be chosen without the city telling a single lie.
//
// ⭐ THE RULE THIS FILE EXISTS TO ENFORCE: free movement WITHIN a tier, never ACROSS one.
//
// ⚠ THE TIERS ARE RANK-BASED, WHICH MEANS THE BOUNDARY IS NOISY. Measured on the live file, 131 of
// 4,827 residents sit within 5% of the island cutoff — every one of them would bounce across the
// river on an ordinary balance wiggle, and a building that teleports is exactly what a claimed city
// cannot do. So the boundary has HYSTERESIS, the same shape the rainbow's band-watch uses: you move
// UP at a stricter rank than the one you fall OUT at, and in between you stay where you are.
//
// ⚠ CONVICTION, NOT SIZE. The island is ranked on score = balance x tenure, so the tiers genuinely
// overlap on balance (largest borough wallet 31.3k SPX, smallest island wallet 16.4k). That is the
// honest and interesting fact: a borough resident is not smaller, they are NEWER. Never describe the
// island as "the biggest holders" — it is "the longest-committed", which is a thing you can fix by
// holding rather than by buying.

// ── tiers ─────────────────────────────────────────────────────────────────────────────────────
// Ordered best-first. `share` is the fraction of the population the tier admits where the tier is
// defined by a share (prime); `lots` tiers are capped by the geography instead and get their bound
// passed in, because lot counts come from city-map and depend on the island, not on a constant here.
export const TIERS = ["prime", "island", "borough"];
export const TIER_LABEL = { prime: "Prime towers", island: "Manhattan", borough: "The boroughs" };

// The top 10% are the wallets placeCity restricts to TOWER_HOODS (`bigT > 0.9`). Kept as the same
// number rather than a rounder one so this file and the placer can never disagree about who is a
// tower wallet — if that rule ever moves, both move together.
export const PRIME_SHARE = 0.10;

// Hysteresis, as a fraction of the tier's capacity. Enter at 0.95 of the bound, leave past 1.07.
// The gap is ~12% of capacity, comfortably wider than the 5% score band the boundary crowd sits in,
// so ordinary churn cannot push anyone back and forth. A wallet inside the gap keeps whatever tier
// it already holds; a wallet with no tier yet (a new arrival) is admitted on the STRICTER bound, so
// nobody is handed an island lot they would immediately lose.
export const ENTER = 0.95;
export const LEAVE = 1.07;

/**
 * Which tier a wallet belongs in.
 *
 * @param {number} rank    0-based rank by conviction score (0 = biggest)
 * @param {number} n       population size
 * @param {number} manCap  how many lots Manhattan actually has (from city-map, ~1,680 at k=1)
 * @param {string|null} held  the tier this wallet currently holds, or null for a new arrival
 * @returns {"prime"|"island"|"borough"}
 */
export function tierOf(rank, n, manCap, held = null) {
  const primeCap = Math.max(1, Math.floor(PRIME_SHARE * Math.max(1, n - 1)));
  // Prime is a subset of the island, so it is tested first and an island wallet that outgrows the
  // prime bound simply stays on the island — it never falls to a borough by being demoted.
  if (within(rank, primeCap, held === "prime")) return "prime";
  if (within(rank, manCap, held === "prime" || held === "island")) return "island";
  return "borough";
}

// Inside the hysteresis gap the incumbent keeps its place and the outsider stays out.
const within = (rank, cap, incumbent) => rank < cap * (incumbent ? LEAVE : ENTER);

/**
 * The whole ladder for a population, as one pass. Returns a Map address -> tier, which is what the
 * deed allocator wants: it needs every wallet's tier at once, not one at a time.
 *
 * @param {Array<{a:string}>} ranked  residents sorted by conviction score, biggest first
 * @param {number} manCap
 * @param {Map<string,string>|null} heldBy  address -> tier currently held (from the deed file)
 */
export function tierLadder(ranked, manCap, heldBy = null) {
  const out = new Map();
  ranked.forEach((w, i) => {
    const a = String(w.a || "").toLowerCase();
    out.set(a, tierOf(i, ranked.length, manCap, heldBy?.get(a) ?? null));
  });
  return out;
}

// ── bands ─────────────────────────────────────────────────────────────────────────────────────
// What a wallet may BUILD, as opposed to where it may stand. The cuts are archetype()'s own
// thresholds in city-render.js, unchanged and on purpose: the city already decides masonry /
// concrete / glass at 3.5 / 6 / 11 world units, and those numbers are calibrated to heightOf's
// curve. Reusing them means an owner's style options line up exactly with the silhouettes the
// generated city was already producing, so switching a building from default to chosen never
// changes what SIZE it reads as.
//
// ⚠ IF heightOf's CURVE MOVES, THESE MOVE WITH IT. city-render.js says the same thing about the
// archetype thresholds, for the same reason. Retune them together or the city goes all-glass.
export const BANDS = [
  { id: "lowrise",   label: "Low-rise",   min: 0,    max: 3.5,      family: "masonry"  },
  { id: "midrise",   label: "Mid-rise",   min: 3.5,  max: 6,        family: "masonry"  },
  { id: "tower",     label: "Tower",      min: 6,    max: 11,       family: "concrete" },
  { id: "supertall", label: "Supertall",  min: 11,   max: Infinity, family: "glass"    },
];
export const BAND_IDS = BANDS.map(b => b.id);

/** The band a height sits in. Heights come from heightOf() and are 1.0..21 world units. */
export function bandOf(h) {
  const x = Number.isFinite(h) ? h : 0;
  for (const b of BANDS) if (x >= b.min && x < b.max) return b.id;
  return "supertall";
}

/** Band index, for "can this style stretch up one tier" questions. */
export const bandIndex = id => Math.max(0, BAND_IDS.indexOf(id));

// ── the envelope ──────────────────────────────────────────────────────────────────────────────
// Everything the chain decides about a building, in one object. This is the HALF OF THE CONTRACT
// THAT CANNOT BE OVERRIDDEN — city-identity.js takes it as gospel and will not read any of these
// keys from a saved customization. Keeping it as its own shape (rather than passing a tower around)
// is what makes that guarantee checkable: if a key is not in here, an owner cannot influence it.
export function envelopeOf({ a, rank, n, manCap, height, tier, lot, hood, width = 1, depth = 1 }) {
  const t = tier || tierOf(rank, n, manCap);
  const band = bandOf(height);
  return Object.freeze({
    a: String(a || "").toLowerCase(),
    rank, tier: t, band, height,
    lot: lot ?? null, hood: hood ?? null,
    width, depth,
    // Landmarks are the top three, who wear hand-authored hero silhouettes rather than a style.
    // An owner may recolour one; they may not swap its form, because the skyline's crown is a
    // composition rather than a set of independent choices.
    landmark: rank < 3 ? rank : -1,
  });
}
