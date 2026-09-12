// Rasterizes the social share card (scripts/bot/brand-card.mjs) to public/og-brand.png.
//
//   npm run build:og
//
// Run it whenever the card's SVG or the brand type changes, and commit the PNG — the file is a
// static asset, not a build artifact, because index.html points crawlers straight at it.
//
// The two Geist Mono TTFs in tools/fonts/ are static instances (weight 400 and 700) cut from the
// same variable public/fonts/GeistMono.woff2 the site serves, so the card is set in the site's
// own face. resvg reads TTF/OTF, never woff2 — hence the instanced copies. Regenerate them with:
//   python3 -c "from fontTools.ttLib import TTFont; from fontTools.varLib import instancer; \
//     [ (lambda f: (instancer.instantiateVariableFont(f, {'wght': w}, inplace=True, updateFontNames=True), \
//        f.save('tools/fonts/GeistMono-' + n + '.ttf')))(TTFont('public/fonts/GeistMono.woff2')) \
//        for w, n in [(400,'Regular'), (700,'Bold')] ]"
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { brandCardSvg } from "./bot/brand-card.mjs";

const OUT = join(process.cwd(), "public/og-brand.png");
const W = 1200;

const svg = brandCardSvg({ W, H: 630 });
const png = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: {
    fontFiles: ["tools/fonts/GeistMono-Regular.ttf", "tools/fonts/GeistMono-Bold.ttf"].map(p => join(process.cwd(), p)),
    loadSystemFonts: false,
    defaultFontFamily: "Geist Mono",
  },
}).render().asPng();

writeFileSync(OUT, png);
console.log(`og-brand.png  ${W}×630  ${(png.length / 1024).toFixed(1)} KB  →  ${OUT}`);
