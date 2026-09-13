// THE STYLE REGISTRY — what an owner is allowed to build, and on which envelope.
//
// This file is the CONTRACT between the data layer (which decides how big your building is) and the
// renderer (which decides what it looks like). It names every style, says which height bands each
// one can honestly be built in, and lists the form variants and palettes that belong to it. It
// contains NO geometry and imports no three.js — a style here is a description, and the renderer is
// what turns it into triangles. That separation is the point: this file can be read by the deed
// builder, the editor UI, a test, and the card renderer without any of them pulling in a 3D engine.
//
// ⭐⭐ WHY STYLES ARE BAND-LOCKED. archetype() in city-render.js picks a building's material family
// FROM ITS HEIGHT, which is how the city gets its read: 5% glass towers, 24% concrete mid-rise, 71%
// masonry, and boroughs that are 97% low-rise with no towers at all. None of that is a rule anybody
// wrote — it falls out of the holdings distribution. Let a 1.0-unit wallet pick "Glass Supertall"
// and silhouette stops saying anything about scale.
//
// So a style declares `bands`, and the picker only ever offers what fits. This keeps the promise
// that matters — a small holder CAN have a beautiful futuristic building, there is a futuristic
// low-rise — while nobody wears a supertall silhouette on a townhouse envelope. Height itself is
// never touched by anything in this file.
//
// ⭐ VARIANTS ARE INDICES INTO THE EXISTING 50-FORM LIBRARY, not new geometry. The prototype at
// prototypes/spx-city-2.0/src/district/silhouettes.js already ships fifty named, envelope-normalised
// forms with three bounded variations each. A "style" is a curated GROUP of those forms plus a
// facade kit, a crown set and a palette set. That is why twelve styles is a curation job rather than
// a modelling project — and why adding a thirteenth costs one entry here.
//
// ⚠ DO NOT ADD A STYLE WITHOUT A BAND. An empty or missing `bands` array means "buildable at any
// size", which is precisely the failure this file exists to prevent. The test asserts every style
// declares at least one band and that every band is covered by at least three styles, so no owner
// ever opens the picker and finds two options.

import { BAND_IDS } from "./city-tiers.js";

/** Schema version. Bump when the SHAPE changes; saved customizations carry their own `v`. */
export const REGISTRY_VERSION = "spx-city-styles-v1";

// ── palettes ──────────────────────────────────────────────────────────────────────────────────
// ⭐ CURATED PAIRS, NOT FREE HEX. Free colour lets someone paint a building pure black or pure
// white, which breaks the dusk read for every neighbour, and it turns validation into a colour
// science problem. A closed set is one comparison to validate, keeps the city coherent, and is
// still plenty of choice: six palettes x five variants x three crowns is ninety distinct buildings
// inside a single style before the envelope varies them further.
//
// Each entry is [primary, accent]. Luminance is deliberately kept inside a mid band — nothing here
// is darker than #16 or brighter than #ea, so no facade disappears at night or blows out at noon.
export const PALETTES = {
  stone:     ["#8c8579", "#c9bfa8"],
  limestone: ["#c6bda6", "#e4dcc6"],
  brick:     ["#8a5541", "#c9a07c"],
  slate:     ["#4e5865", "#94a2b4"],
  ink:       ["#2a2b30", "#c8a45c"],   // the black-and-gold Art Deco pairing
  bronze:    ["#6b5335", "#d6a95f"],
  copper:    ["#5d6f68", "#9fd0c0"],
  sand:      ["#bfa987", "#efe3cc"],
  steel:     ["#6d7681", "#cfd7df"],
  oxblood:   ["#6a3a3a", "#c98a7a"],
  glacier:   ["#8fa6b8", "#dceaf3"],
  moss:      ["#5a6b53", "#a8bf95"],
};
export const PALETTE_IDS = Object.keys(PALETTES);

// ── window treatments ─────────────────────────────────────────────────────────────────────────
// ⚠ THESE TINT THE GLASS, NOT THE LIGHT. The emissive window channel is already spent: the city
// says buying with green, selling with red, and holding age with a warm-to-cyan ramp, all at full
// strength under the "stone and light" rule in city-render.js. A window style changes the PANE
// (its pattern, its reflectivity, how much of the facade it covers) and never the emitted colour,
// or a cosmetic choice starts reading as a data signal.
export const WINDOWS = ["clear", "warm", "smoked", "mirrored", "leaded", "industrial"];

// ── crowns ────────────────────────────────────────────────────────────────────────────────────
// Roof treatments. Band-gated in the style entries because a spire on a two-storey building is a
// weathervane, and a water tower on a supertall is a joke.
export const CROWNS = [
  "flat", "parapet", "cornice", "mansard", "gabled", "stepped",
  "spire", "finial", "dome", "mast", "terrace", "helipad",
];

// ── rooftop objects ───────────────────────────────────────────────────────────────────────────
// Purely decorative clutter, placed by the renderer on the roof plane. `minBand` keeps the list
// honest — a helipad belongs to a building that could plausibly have one.
export const ROOF_OBJECTS = [
  { id: "water_tower", label: "Water tower",  minBand: "lowrise"   },
  { id: "hvac",        label: "HVAC plant",   minBand: "lowrise"   },
  { id: "garden",      label: "Roof garden",  minBand: "lowrise"   },
  { id: "pergola",     label: "Pergola",      minBand: "midrise"   },
  { id: "billboard",   label: "Billboard",    minBand: "midrise"   },
  { id: "dish",        label: "Satellite dish", minBand: "midrise" },
  { id: "beacon",      label: "Beacon",       minBand: "tower"     },
  { id: "helipad",     label: "Helipad",      minBand: "tower"     },
  { id: "antenna",     label: "Antenna array", minBand: "supertall" },
  { id: "observatory", label: "Observation deck", minBand: "supertall" },
];

// ── the styles ────────────────────────────────────────────────────────────────────────────────
// `variants` are indices into the silhouette library. Where a style spans several bands the SAME
// style id maps to different forms at different heights — that is what lets a building grow from a
// brownstone into a tower and still be recognisably "yours" (see city-identity.js `promote`).
//
// `family` decides the PBR treatment (roughness / metalness / env intensity) via FAMILIES in
// city-render.js. It is a property of the style, not of the height, which is the one place this
// layer deliberately departs from archetype() — a Brutalist tower is concrete whether it is six
// units or sixteen.
const S = (id, name, bands, family, forms, crowns, palettes, blurb) =>
  ({ id, name, bands, family, forms, crowns, palettes, blurb });

export const STYLES = [
  S("classic_manhattan", "Classic Manhattan", ["lowrise", "midrise", "tower"], "masonry",
    { lowrise: [34, 35, 37], midrise: [33, 37, 34], tower: [33, 37, 21] },
    ["parapet", "cornice", "mansard", "gabled"], ["brick", "limestone", "sand", "oxblood"],
    "Pre-war brick and limestone. Fire escapes, cornices, a water tower on the roof."),

  S("art_deco", "Art Deco", ["midrise", "tower", "supertall"], "concrete",
    { midrise: [22, 39, 2], tower: [2, 22, 39, 23], supertall: [2, 3, 23, 4] },
    ["stepped", "spire", "finial", "cornice"], ["ink", "bronze", "limestone", "sand"],
    "Setbacks, vertical piers and a crown that steps to a point. Black and gold if you want it."),

  S("neo_gothic", "Neo-Gothic", ["midrise", "tower", "supertall"], "masonry",
    { midrise: [22, 33], tower: [3, 22, 28], supertall: [3, 27, 28] },
    ["spire", "finial", "parapet"], ["stone", "oxblood", "slate", "brick"],
    "Vertical ribs, pointed crowns, stone that looks carved rather than poured."),

  S("brutalist", "Brutalist", ["midrise", "tower", "supertall"], "concrete",
    { midrise: [38, 39], tower: [38, 39, 21], supertall: [39, 21, 49] },
    ["flat", "parapet", "terrace"], ["stone", "slate", "steel", "moss"],
    "Board-marked concrete, deep shadow, mass that reads as one piece."),

  S("international", "International Style", ["midrise", "tower", "supertall"], "glass",
    { midrise: [40, 41], tower: [40, 41, 0], supertall: [49, 41, 0] },
    ["flat", "parapet"], ["steel", "slate", "glacier"],
    "Curtain wall on a plaza. A grid, honestly expressed, nothing else."),

  S("modern_minimal", "Modern Minimalist", ["lowrise", "midrise", "tower", "supertall"], "concrete",
    { lowrise: [37, 33], midrise: [37, 0, 6], tower: [0, 6, 5], supertall: [5, 49, 0] },
    ["flat", "parapet", "terrace"], ["stone", "steel", "glacier", "sand"],
    "Flat planes, recessed glazing, one material carried all the way up."),

  S("glass_supertall", "Glass Supertall", ["tower", "supertall"], "glass",
    { tower: [5, 41, 27], supertall: [5, 27, 49, 41] },
    ["flat", "mast", "spire", "helipad"], ["glacier", "steel", "slate"],
    "A pencil of glass. Nothing but structure, mullions and sky."),

  S("futuristic", "Futuristic", ["lowrise", "midrise", "tower", "supertall"], "glass",
    { lowrise: [6, 26], midrise: [6, 9, 26], tower: [9, 42, 43, 48], supertall: [9, 43, 48, 10] },
    ["dome", "mast", "beacon", "terrace"], ["copper", "glacier", "moss", "steel"],
    "Twisted, faceted or diagrid. The one style that works at every size."),

  S("retro_futurist", "Retro-futurist", ["midrise", "tower", "supertall"], "concrete",
    { midrise: [26, 25], tower: [48, 25, 26], supertall: [48, 10, 13] },
    ["dome", "finial", "mast"], ["copper", "bronze", "sand", "oxblood"],
    "The future as it looked in 1962 — domes, saucers, a ring balcony."),

  S("industrial_loft", "Industrial / Loft", ["lowrise", "midrise", "tower"], "masonry",
    { lowrise: [36, 35], midrise: [36, 35, 44], tower: [44, 45, 38] },
    ["flat", "parapet", "gabled"], ["brick", "oxblood", "slate", "stone"],
    "Cast iron and sawtooth glazing. A warehouse that became somewhere to live."),

  S("luxury_residential", "Luxury Residential", ["midrise", "tower", "supertall"], "concrete",
    { midrise: [31, 32, 46], tower: [46, 47, 31], supertall: [5, 46, 47] },
    ["terrace", "cornice", "helipad", "parapet"], ["limestone", "sand", "bronze", "glacier"],
    "Deep balconies, a setback garden every few floors, a lobby you can see into."),

  S("postmodern", "Postmodern", ["midrise", "tower", "supertall"], "concrete",
    { midrise: [23, 24], tower: [23, 24, 29, 30], supertall: [23, 29, 30] },
    ["gabled", "stepped", "finial", "dome"], ["sand", "oxblood", "copper", "limestone"],
    "A quotation with a straight face — a broken pediment on an office block."),
];

export const STYLE_BY_ID = Object.fromEntries(STYLES.map(s => [s.id, s]));
export const STYLE_IDS = STYLES.map(s => s.id);

// The style an unclaimed building is treated as. It is NOT rendered from this registry — an
// unclaimed building keeps the exact hash-derived look it has today — but the editor needs
// something to show as "currently" before the owner picks, and the resolver needs a safe target.
export const DEFAULT_STYLE = "classic_manhattan";

// ── what a given envelope may choose ──────────────────────────────────────────────────────────

/** Styles buildable on this band, in registry order. Never empty for a valid band. */
export function stylesFor(band, entitlements = null) {
  const owned = entitlements instanceof Set ? entitlements : null;
  return STYLES.filter(s =>
    s.bands.includes(band) && (!s.locked || (owned && owned.has(s.id))));
}

/** How many form variants a style offers on a band (0 if the style cannot be built there). */
export function variantCount(styleId, band) {
  const forms = STYLE_BY_ID[styleId]?.forms?.[band];
  return Array.isArray(forms) ? forms.length : 0;
}

/** The silhouette-library index for a (style, band, variant). Null if the combination is invalid. */
export function formIndex(styleId, band, variant) {
  const forms = STYLE_BY_ID[styleId]?.forms?.[band];
  if (!Array.isArray(forms) || !forms.length) return null;
  const i = Number.isInteger(variant) ? variant : 0;
  return forms[((i % forms.length) + forms.length) % forms.length];
}

/** Crowns this style allows on this band. Band-gated so a spire cannot land on a shopfront. */
export function crownsFor(styleId, band) {
  const s = STYLE_BY_ID[styleId];
  if (!s) return ["flat"];
  const tall = band === "tower" || band === "supertall";
  return s.crowns.filter(c => tall || (c !== "spire" && c !== "mast" && c !== "helipad" && c !== "dome"));
}

/** Rooftop objects allowed on this band. */
export function roofObjectsFor(band) {
  const at = BAND_IDS.indexOf(band);
  return ROOF_OBJECTS.filter(o => BAND_IDS.indexOf(o.minBand) <= at);
}

/** Palettes this style allows. */
export const palettesFor = styleId => STYLE_BY_ID[styleId]?.palettes ?? PALETTE_IDS;
