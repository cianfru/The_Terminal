// Rasterizes the social share card (scripts/bot/brand-card.mjs) to public/og-brand.png.
//
//   npm run build:og
//
// Run it whenever the lockup artwork or the line under it changes, and commit the PNG — the file
// is a static asset, not a build artifact, because index.html points crawlers straight at it.
//
// The artwork is inlined as a data: URI: resvg does not resolve remote (or relative) hrefs, so an
// <image href="/brand-lockup.png"> would silently render as nothing. The pixel face is read from
// the same public/fonts/PxVGA.ttf the site serves.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { brandCardSvg } from "./bot/brand-card.mjs";

const at = p => join(process.cwd(), p);
const OUT = at("public/og-brand.png");
const W = 1200;

const art = readFileSync(at("public/brand-lockup.png"));
const svg = brandCardSvg({ W, H: 630, lockup: `data:image/png;base64,${art.toString("base64")}` });

const png = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: { fontFiles: [at("public/fonts/PxVGA.ttf")], loadSystemFonts: false, defaultFontFamily: "Px437 IBM VGA 8x16" },
}).render().asPng();

writeFileSync(OUT, png);
console.log(`og-brand.png  ${W}×630  ${(png.length / 1024).toFixed(1)} KB  →  ${OUT}`);
