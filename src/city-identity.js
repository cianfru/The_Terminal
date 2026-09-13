// THE RESOLVER — the one place where chain data and owner taste meet, and the only place they can.
//
// Three layers go in, one identity comes out:
//
//   envelope  what the chain decided   plot, tier, band, height, footprint, rank, landmark
//   base      the deterministic default  the hash-derived look every building has had until now
//   custom    what the owner saved       a sparse bag of cosmetic keys, possibly hostile
//
// ⭐⭐ THIS IS A WHITELIST, NOT A MERGE. `custom` is never spread over anything. Each cosmetic key is
// read by name, validated against the envelope, and dropped back to `base` if it does not fit. The
// guarantee that falls out of that is structural rather than careful: THERE IS NO CODE PATH THAT
// READS A POSITIONAL OR SCALAR KEY FROM `custom`, so a hand-written save blob cannot move a plot,
// change a height, promote a tier or forge a rank. Not "we check for that" — there is nothing to
// check, because nothing reads it.
//
// ⚠ IF YOU ADD A COSMETIC KEY, ADD IT TO THE WHITELIST BELOW AND TO validateCustom(). If you find
// yourself wanting to add a key that is in the envelope, stop: that is the feature asking to become
// a lie. The city is a map of who holds SPX. Everything an owner controls has to be invisible to
// that reading.
//
// Pure, no three.js, no DOM: the deed builder, the editor, the card renderer and the tests all
// import this and therefore cannot drift about what a building actually is.

import { bandIndex, BAND_IDS } from "./city-tiers.js";
import {
  STYLE_BY_ID, DEFAULT_STYLE, PALETTES, WINDOWS, CROWNS,
  stylesFor, variantCount, formIndex, crownsFor, roofObjectsFor, palettesFor,
} from "./city-styles.js";

/** Schema version of a SAVED customization. Stored as `v` on every record. */
export const CUSTOM_VERSION = 1;

// Everything an owner may set. Anything not on this list is ignored on read and rejected on write.
export const COSMETIC_KEYS = [
  "style", "variant", "palette", "windows", "crown", "roof", "light", "decor",
];

// Accent lighting positions. ⚠ NONE OF THESE IS THE WINDOW CHANNEL. The emissive windows carry flow
// (green buying / red selling) and holding age at full strength; an owner-chosen colour on that
// channel would make a cosmetic act look like an on-chain fact, which is the one thing this feature
// is not allowed to do. So accent light lives on the ground, the entrance and the crown edge.
export const LIGHTS = ["none", "ground_wash", "entrance", "crown_edge", "soffit"];

const MAX_DECOR = 2;              // per building — see the decal budget in the perf notes
const DECOR_FACES = ["n", "e", "s", "w", "roof"];

// ── the deterministic default ─────────────────────────────────────────────────────────────────
// An UNCLAIMED building must look exactly as it does today, so this reproduces the existing
// hash-derived choice rather than inventing a new one: same FNV-1a, same salted-key pattern as
// prototypes/spx-city-2.0/src/identity.js. The only difference is that the style is drawn from the
// styles this envelope's band actually allows, so a default and a chosen building are drawn by the
// same code path and a claim never changes a building's SIZE, only its specificity.
const fnv = s => {
  let h = 2166136261;
  const str = String(s || "").toLowerCase();
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const pick = (addr, key, n) => (n > 0 ? fnv(`spx-city|${addr}|${key}`) % n : 0);

export function baseIdentity(envelope) {
  const a = envelope.a, band = envelope.band;
  const options = stylesFor(band);
  const style = options.length ? options[pick(a, "style", options.length)].id : DEFAULT_STYLE;
  const pals = palettesFor(style), crowns = crownsFor(style, band);
  return {
    style,
    variant: pick(a, "variant", Math.max(1, variantCount(style, band))),
    palette: pals[pick(a, "palette", pals.length)],
    windows: WINDOWS[pick(a, "windows", WINDOWS.length)],
    crown: crowns[pick(a, "crown", crowns.length)],
    roof: [],
    light: "none",
    decor: [],
  };
}

// ── validation ────────────────────────────────────────────────────────────────────────────────
// Applied on the way IN (the save endpoint refuses bad input) and again on the way OUT (the
// renderer ignores anything that stopped fitting). The same doctrine city-messages.js uses for
// notes, and for the same reason: the stored record can outlive the rules that accepted it. A
// wallet that shrinks out of its band gets its style repaired at render time rather than at write
// time, because nobody should have their building edited by a price move.

const isStr = v => typeof v === "string" && v.length > 0 && v.length <= 40;
const num = (v, lo, hi, dflt) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);

/**
 * Check a customization against an envelope WITHOUT repairing it.
 * @returns {string[]} problems, empty when the record is fully valid here.
 */
export function validateCustom(custom, envelope) {
  const errs = [];
  if (!custom || typeof custom !== "object") return ["not an object"];
  for (const k of Object.keys(custom)) {
    if (!COSMETIC_KEYS.includes(k) && !["v", "rev", "a", "by", "at", "serial"].includes(k)) {
      errs.push(`unknown key "${k}"`);
    }
  }
  const band = envelope.band;
  if (custom.style !== undefined) {
    if (!isStr(custom.style) || !STYLE_BY_ID[custom.style]) errs.push("unknown style");
    else if (!STYLE_BY_ID[custom.style].bands.includes(band)) errs.push(`style not buildable on a ${band} envelope`);
  }
  const style = STYLE_BY_ID[custom.style] ? custom.style : DEFAULT_STYLE;
  if (custom.variant !== undefined && !Number.isInteger(custom.variant)) errs.push("variant must be an integer");
  if (custom.palette !== undefined && !palettesFor(style).includes(custom.palette)) errs.push("palette not offered by this style");
  if (custom.windows !== undefined && !WINDOWS.includes(custom.windows)) errs.push("unknown window treatment");
  if (custom.crown !== undefined && !crownsFor(style, band).includes(custom.crown)) errs.push("crown not allowed on this band");
  if (custom.light !== undefined && !LIGHTS.includes(custom.light)) errs.push("unknown accent light");
  if (custom.roof !== undefined) {
    if (!Array.isArray(custom.roof)) errs.push("roof must be an array");
    else {
      const ok = new Set(roofObjectsFor(band).map(o => o.id));
      for (const r of custom.roof) if (!ok.has(r)) errs.push(`roof object "${r}" not allowed on this band`);
    }
  }
  if (custom.decor !== undefined) {
    if (!Array.isArray(custom.decor)) errs.push("decor must be an array");
    else {
      if (custom.decor.length > MAX_DECOR) errs.push(`at most ${MAX_DECOR} decorations`);
      for (const d of custom.decor) errs.push(...decorErrors(d));
    }
  }
  return errs;
}

// ⭐ DECORATIONS LIVE IN NORMALISED FACE SPACE, NEVER WORLD UNITS. `u` and `v` are 0..1 across the
// face, which is the single reason a sign survives its building growing: at v=0.78 it stays at 78%
// of the height whatever the height becomes. A world-unit offset would slide down the facade every
// time the owner bought more SPX.
function decorErrors(d) {
  if (!d || typeof d !== "object") return ["decoration is not an object"];
  const e = [];
  if (!isStr(d.a)) e.push("decoration needs an asset id");
  if (!DECOR_FACES.includes(d.face)) e.push("decoration face must be n/e/s/w/roof");
  for (const k of ["u", "v"]) {
    if (typeof d[k] !== "number" || !(d[k] >= 0 && d[k] <= 1)) e.push(`decoration ${k} must be 0..1`);
  }
  if (d.s !== undefined && (typeof d.s !== "number" || d.s <= 0 || d.s > 3)) e.push("decoration scale must be 0..3");
  return e;
}

// ── the resolver ──────────────────────────────────────────────────────────────────────────────

/**
 * Fold an owner's saved cosmetics onto the deterministic default, under the envelope's rules.
 *
 * @param {object} envelope     from city-tiers.envelopeOf — treated as gospel, never read from custom
 * @param {object|null} custom  the saved record, or null for an unclaimed building
 * @param {Set<string>|null} entitlements  style ids unlocked by achievement / OG status, if any
 * @returns {object} the full identity the renderer draws, plus `claimed` and `repaired`
 */
export function resolve(envelope, custom = null, entitlements = null) {
  const base = baseIdentity(envelope);
  const band = envelope.band;
  // An unclaimed building is the default and nothing else — byte-identical to today's city.
  if (!custom || typeof custom !== "object") return finish(envelope, base, base, false, []);

  const repaired = [];
  const out = { ...base };

  // style ─ the only key that can invalidate every key after it, so it resolves first.
  const allowed = new Set(stylesFor(band, entitlements).map(s => s.id));
  if (isStr(custom.style) && STYLE_BY_ID[custom.style]) {
    if (allowed.has(custom.style)) out.style = custom.style;
    else {
      // ⭐ THE GROWTH CASE, AND WHY IT IS A REPAIR RATHER THAN A RESET. A wallet that outgrows (or
      // falls out of) its style's band keeps the style if the registry can build it at the new size,
      // and only falls back to the default when it genuinely cannot. `promote` does the search; the
      // owner is told about it in the editor rather than silently re-skinned.
      const kept = promote(custom.style, band);
      out.style = kept ?? base.style;
      repaired.push(kept ? `style rebuilt at ${band}` : `style not buildable at ${band}`);
    }
  } else if (custom.style !== undefined) repaired.push("unknown style");

  // variant ─ wrapped into range rather than rejected, so a style with fewer forms on the new band
  // still lands on a real one instead of dropping to variant 0 and losing the owner's choice.
  const nV = Math.max(1, variantCount(out.style, band));
  out.variant = Number.isInteger(custom.variant) ? ((custom.variant % nV) + nV) % nV : base.variant % nV;

  const pals = palettesFor(out.style);
  out.palette = pals.includes(custom.palette) ? custom.palette : (pals.includes(base.palette) ? base.palette : pals[0]);
  out.windows = WINDOWS.includes(custom.windows) ? custom.windows : base.windows;

  const crowns = crownsFor(out.style, band);
  out.crown = crowns.includes(custom.crown) ? custom.crown : (crowns.includes(base.crown) ? base.crown : crowns[0]);

  out.light = LIGHTS.includes(custom.light) ? custom.light : "none";

  const roofOk = new Set(roofObjectsFor(band).map(o => o.id));
  out.roof = Array.isArray(custom.roof) ? custom.roof.filter(r => roofOk.has(r)).slice(0, 4) : [];
  if (Array.isArray(custom.roof) && out.roof.length < custom.roof.length) repaired.push("some roof objects dropped for this band");

  out.decor = Array.isArray(custom.decor)
    ? custom.decor.filter(d => decorErrors(d).length === 0).slice(0, MAX_DECOR).map(cleanDecor)
    : [];

  return finish(envelope, base, out, true, repaired);
}

const cleanDecor = d => ({
  a: d.a, face: d.face,
  u: num(d.u, 0, 1, 0.5), v: num(d.v, 0, 1, 0.5),
  s: num(d.s, 0.05, 3, 1), r: num(d.r, -180, 180, 0),
});

// ⭐ THE ENVELOPE IS STAMPED ON LAST AND UNCONDITIONALLY. Whatever happened above, these values come
// from the chain — so even a bug in the cosmetic branches cannot produce an identity that disagrees
// with the data. This is the line the tests assert against.
function finish(envelope, base, chosen, claimed, repaired) {
  return Object.freeze({
    ...chosen,
    a: envelope.a,
    height: envelope.height,
    width: envelope.width,
    depth: envelope.depth,
    band: envelope.band,
    tier: envelope.tier,
    rank: envelope.rank,
    lot: envelope.lot,
    hood: envelope.hood,
    landmark: envelope.landmark,
    family: STYLE_BY_ID[chosen.style]?.family ?? "masonry",
    form: formIndex(chosen.style, envelope.band, chosen.variant),
    colours: PALETTES[chosen.palette] ?? PALETTES[base.palette] ?? ["#8c8579", "#c9bfa8"],
    claimed,
    repaired,
  });
}

/**
 * The nearest band a style CAN be built in, searching outward from the one asked for. Used when a
 * wallet grows or shrinks across a band boundary: keeping the style is what makes it still feel
 * like their building, so it is tried before any fallback.
 * @returns {string|null} the style id if it survives at `band`, else null
 */
export function promote(styleId, band) {
  const s = STYLE_BY_ID[styleId];
  if (!s) return null;
  return s.bands.includes(band) ? styleId : null;
}

/**
 * Which band a style would need for the owner's current choice to survive — what the editor shows
 * as "your building is a tower; this style stops at mid-rise".
 */
export function bandsOf(styleId) {
  return STYLE_BY_ID[styleId]?.bands ?? [];
}

/** Distance in bands between where a style tops out and where the building actually is. */
export function bandGap(styleId, band) {
  const bs = bandsOf(styleId);
  if (!bs.length) return Infinity;
  const at = bandIndex(band);
  return Math.min(...bs.map(b => Math.abs(bandIndex(b) - at)));
}

/** Convenience for the card and the editor: the full option set for one envelope. */
export function optionsFor(envelope, entitlements = null) {
  const band = envelope.band;
  return {
    band,
    bandLabel: BAND_IDS.includes(band) ? band : "lowrise",
    styles: stylesFor(band, entitlements).map(s => ({
      id: s.id, name: s.name, blurb: s.blurb,
      variants: variantCount(s.id, band),
      palettes: palettesFor(s.id),
      crowns: crownsFor(s.id, band),
    })),
    windows: WINDOWS,
    lights: LIGHTS,
    roof: roofObjectsFor(band),
    maxDecor: MAX_DECOR,
  };
}

/** Normalise a record on the way into storage. Throws with the reasons if it cannot be stored. */
export function prepareCustom(custom, envelope, meta = {}) {
  const errs = validateCustom(custom, envelope);
  if (errs.length) { const e = new Error(errs.join("; ")); e.problems = errs; throw e; }
  const r = resolve(envelope, custom);
  return {
    v: CUSTOM_VERSION,
    rev: Number.isInteger(meta.rev) ? meta.rev + 1 : 1,
    a: envelope.a,
    style: r.style, variant: r.variant, palette: r.palette,
    windows: r.windows, crown: r.crown, roof: r.roof, light: r.light, decor: r.decor,
    by: meta.by ?? null,
    at: meta.at ?? new Date().toISOString(),
  };
}

export { CROWNS, WINDOWS };
